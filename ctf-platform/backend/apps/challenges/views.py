import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import Challenge, HintUnlock, Solve
from .serializers import ChallengeDetailSerializer, ChallengeListSerializer, SubmitSerializer

User = get_user_model()
log = logging.getLogger(__name__)


def _solve_counts() -> dict[str, int]:
    return dict(
        Solve.objects.values("challenge__slug")
        .annotate(n=Count("id"))
        .values_list("challenge__slug", "n")
    )


def _first_bloods() -> dict[str, str]:
    """Retorna {slug: username} del primer solver de cada challenge."""
    return dict(
        Solve.objects.filter(is_first_blood=True)
        .values_list("challenge__slug", "user__username")
    )


class ChallengeListView(generics.ListAPIView):
    serializer_class = ChallengeListSerializer

    def get_queryset(self):
        from apps.users.models import CompetitionConfig
        qs = Challenge.objects.filter(is_active=True)
        if self.request.query_params.get("all") == "true":
            return qs
        config = CompetitionConfig.get_solo()
        if config.competition_mode and config.challenge_slugs:
            qs = qs.filter(slug__in=config.challenge_slugs)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["solved_slugs"] = set(
            Solve.objects.filter(user=self.request.user)
            .values_list("challenge__slug", flat=True)
        )
        ctx["solve_counts"] = _solve_counts()
        ctx["first_bloods"] = _first_bloods()
        return ctx


class ChallengeDetailView(generics.RetrieveAPIView):
    serializer_class = ChallengeDetailSerializer
    lookup_field = "slug"

    @method_decorator(ratelimit(key="user_or_ip", rate="60/m", method="GET", block=True))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return Challenge.objects.filter(is_active=True)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        challenge = self.get_object()
        ctx["solved_slugs"] = set(
            Solve.objects.filter(user=self.request.user)
            .values_list("challenge__slug", flat=True)
        )
        ctx["unlocked_hint_indices"] = set(
            HintUnlock.objects.filter(user=self.request.user, challenge=challenge)
            .values_list("hint_index", flat=True)
        )
        ctx["solve_count"] = Solve.objects.filter(challenge=challenge).count()
        fb = Solve.objects.filter(challenge=challenge, is_first_blood=True).first()
        ctx["first_blood_username"] = fb.user.username if fb else None
        return ctx


class SubmitFlagView(generics.GenericAPIView):
    serializer_class = SubmitSerializer

    @method_decorator(ratelimit(key="user_or_ip", rate="10/m", method="POST", block=True))
    def post(self, request, slug):
        from apps.users.models import CompetitionConfig
        config = CompetitionConfig.get_solo()
        now = timezone.now()
        if config.start_time and now < config.start_time:
            return Response(
                {"detail": "La competencia aún no ha comenzado.", "correct": False},
                status=status.HTTP_403_FORBIDDEN,
            )
        if config.end_time and now > config.end_time:
            return Response(
                {"detail": "La competencia ha finalizado.", "correct": False},
                status=status.HTTP_403_FORBIDDEN,
            )

        challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

        if config.competition_mode and config.challenge_slugs and slug not in config.challenge_slugs:
            return Response(
                {"detail": "Este reto no está incluido en la competencia.", "correct": False},
                status=status.HTTP_403_FORBIDDEN,
            )

        if Solve.objects.filter(user=request.user, challenge=challenge).exists():
            return Response(
                {"detail": "Already solved", "correct": False},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # En modo competencia: verificar deduplicación por equipo
        team = None
        if config.competition_mode:
            from apps.teams.models import TeamMembership
            try:
                team = request.user.team_membership.team
                if team.is_banned:
                    return Response(
                        {"detail": "Tu equipo está baneado.", "correct": False},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                if Solve.objects.filter(
                    user__team_membership__team=team,
                    challenge=challenge,
                ).exists():
                    return Response(
                        {"detail": "Tu equipo ya resolvió este reto.", "correct": False},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except TeamMembership.DoesNotExist:
                team = None

        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)

        if not challenge.verify(ser.validated_data["flag"]):
            log.info("wrong flag challenge=%s user=%s", slug, request.user.id)
            return Response({"correct": False, "message": "Flag incorrecta"})

        with transaction.atomic():
            # solve_count ANTES de este solve determina los puntos dinámicos
            solve_count = Solve.objects.filter(challenge=challenge).count()
            is_first_blood = (solve_count == 0)

            # Scoring dinámico desde DB (sobrescribe el env var)
            if config.dynamic_scoring:
                points_earned = challenge.compute_points(solve_count)
            else:
                points_earned = challenge.points

            # Bonus de first blood desde DB
            blood_bonus = 0
            bonus_pct = config.first_blood_bonus_pct
            if is_first_blood and bonus_pct > 0:
                blood_bonus = max(1, int(points_earned * bonus_pct / 100))
                points_earned += blood_bonus

            Solve.objects.create(
                user=request.user,
                challenge=challenge,
                points_earned=points_earned,
                is_first_blood=is_first_blood,
            )
            User.objects.filter(pk=request.user.pk).update(
                score=F("score") + points_earned,
                solved_count=F("solved_count") + 1,
            )
            if team is not None:
                from apps.teams.models import Team
                Team.objects.filter(pk=team.pk).update(
                    score=F("score") + points_earned,
                    solved_count=F("solved_count") + 1,
                )
            try:
                from apps.ws.tasks import broadcast_scoreboard, broadcast_first_blood
                if is_first_blood:
                    team_name = team.name if team else None
                    broadcast_first_blood.delay(
                        challenge.slug, challenge.name,
                        request.user.username, team_name, points_earned,
                    )
                broadcast_scoreboard.delay()
            except Exception:
                pass

        log.info(
            "solved challenge=%s user=%s team=%s points=%s first_blood=%s",
            slug, request.user.id, team and team.id, points_earned, is_first_blood,
        )
        msg = f"¡Correcto! +{points_earned} puntos."
        if is_first_blood:
            msg = f"🩸 ¡FIRST BLOOD! +{points_earned} puntos" + (f" (+{blood_bonus} bonus)" if blood_bonus else "") + "."
        return Response({
            "correct": True,
            "points_earned": points_earned,
            "is_first_blood": is_first_blood,
            "message": msg,
        })


class UnlockHintView(generics.GenericAPIView):

    @method_decorator(ratelimit(key="user_or_ip", rate="20/m", method="POST", block=True))
    def post(self, request, slug, index):
        challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

        if index < 0 or index >= len(challenge.hints):
            return Response({"detail": "Pista no existe"}, status=status.HTTP_404_NOT_FOUND)

        hint = challenge.hints[index]
        cost = hint.get("cost", 0)

        existing = HintUnlock.objects.filter(
            user=request.user, challenge=challenge, hint_index=index
        ).first()
        if existing:
            return Response({"text": hint["text"], "cost": cost, "already_unlocked": True})

        if cost > 0:
            with transaction.atomic():
                updated = (
                    User.objects.select_for_update()
                    .filter(pk=request.user.pk, score__gte=cost)
                    .update(score=F("score") - cost)
                )
                if not updated:
                    return Response(
                        {"detail": "Puntos insuficientes para desbloquear esta pista"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                HintUnlock.objects.create(
                    user=request.user, challenge=challenge, hint_index=index
                )
        else:
            HintUnlock.objects.create(
                user=request.user, challenge=challenge, hint_index=index
            )

        log.info("hint_unlock challenge=%s hint=%s user=%s cost=%s", slug, index, request.user.id, cost)
        return Response(
            {"text": hint["text"], "cost": cost, "already_unlocked": False, "points_deducted": cost}
        )


class AdminChallengesView(generics.GenericAPIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_students = User.objects.filter(is_staff=False).count()
        challenges = (
            Challenge.objects
            .annotate(solve_count=Count("solve", distinct=True))
            .order_by("points")
        )
        is_dynamic = getattr(settings, "DYNAMIC_SCORING", False)
        return Response([
            {
                "slug": c.slug,
                "name": c.name,
                "points": c.points,
                "current_points": c.compute_points(c.solve_count),
                "min_points": c.min_points,
                "decay": c.decay,
                "is_dynamic": is_dynamic,
                "is_active": c.is_active,
                "solve_count": c.solve_count,
                "total_students": total_students,
            }
            for c in challenges
        ])


class AdminChallengeToggleView(generics.GenericAPIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, slug):
        challenge = get_object_or_404(Challenge, slug=slug)
        challenge.is_active = not challenge.is_active
        challenge.save(update_fields=["is_active"])
        return Response({"slug": challenge.slug, "is_active": challenge.is_active})


class AdminChallengeSolucionarioView(generics.GenericAPIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, slug):
        import glob as glob_module
        import os
        import markdown as md

        get_object_or_404(Challenge, slug=slug)

        soluciones_dir = os.path.join(
            settings.BASE_DIR, "..", "soluciones"
        )
        normalized = slug.replace("-", "_")
        pattern = os.path.join(soluciones_dir, f"*_{normalized}.md")
        matches = glob_module.glob(pattern)

        if not matches:
            return Response({"html": None, "found": False})

        with open(matches[0], encoding="utf-8") as f:
            raw = f.read()

        html = md.markdown(raw, extensions=["fenced_code", "tables", "toc"])
        return Response({"html": html, "found": True})
