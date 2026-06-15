import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Sum
from django.utils.decorators import method_decorator
from django.utils.dateparse import parse_datetime
from django_ratelimit.decorators import ratelimit
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.challenges.models import HintUnlock, Solve
from .models import CompetitionConfig
from .serializers import RegisterSerializer, ScoreboardSerializer, UserSerializer

User = get_user_model()
log = logging.getLogger(__name__)


class RegistrationStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.teams.models import Team
        config = CompetitionConfig.get_solo()
        teams_count = Team.objects.filter(is_banned=False).count()
        teams_remaining = (
            max(0, config.max_teams - teams_count)
            if config.max_teams is not None
            else None
        )
        return Response({
            "registration_open": config.registration_open,
            "competition_name": config.name,
            "competition_description": config.description,
            "competition_mode": config.mode,
            "competition_active": config.competition_mode,
            "teams_count": teams_count,
            "teams_remaining": teams_remaining,
            "max_teams": config.max_teams,
            "max_members": config.max_members,
        })


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    @method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=True))
    def post(self, request, *args, **kwargs):
        config = CompetitionConfig.get_solo()
        if not config.registration_open:
            return Response(
                {"detail": "El registro está cerrado. Contacta al administrador."},
                status=403,
            )
        return super().post(request, *args, **kwargs)


class LoginView(TokenObtainPairView):
    @method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True))
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh = response.data.pop("refresh", None)
            if refresh:
                response.set_cookie(
                    "refresh", refresh,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite="Lax",
                    max_age=7 * 24 * 3600,
                    path="/api/auth/",
                )
        return response


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        response = Response(status=204)
        response.delete_cookie("refresh", path="/api/auth/")
        return response


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_cookie = request.COOKIES.get("refresh")
        if "refresh" not in request.data and refresh_cookie:
            data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
            data["refresh"] = refresh_cookie
            request._full_data = data

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            new_refresh = response.data.pop("refresh", None)
            if new_refresh:
                response.set_cookie(
                    "refresh", new_refresh,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite="Lax",
                    max_age=7 * 24 * 3600,
                    path="/api/auth/",
                )
        return response


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


def _frozen_entries(freeze_time):
    """Calcula el ranking congelado a partir de Solve.points_earned."""
    rows = (
        Solve.objects
        .filter(solved_at__lte=freeze_time)
        .values("user__username")
        .annotate(score=Sum("points_earned"), solved_count=Count("id"))
        .order_by("-score", "-solved_count", "user__username")[:100]
    )
    return [
        {
            "username": r["user__username"],
            "score": r["score"] or 0,
            "solved_count": r["solved_count"],
        }
        for r in rows
    ]


class ScoreboardView(APIView):
    """
    Scoreboard público. Retorna:
        { frozen, freeze_time, entries: [{username, score, solved_count}] }

    Cuando frozen=True los entries reflejan el estado en freeze_time.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        config = CompetitionConfig.get_solo()

        if config.is_frozen and config.freeze_time:
            entries = _frozen_entries(config.freeze_time)
        else:
            entries = list(
                User.objects
                .filter(score__gt=0)
                .order_by("-score", "-solved_count", "username")
                .values("username", "score", "solved_count")[:100]
            )

        return Response({
            "frozen": config.is_frozen,
            "freeze_time": config.freeze_time.isoformat() if config.freeze_time else None,
            "entries": entries,
        })


def _config_to_dict(config):
    return {
        "name": config.name,
        "description": config.description,
        "competition_mode": config.competition_mode,
        "mode": config.mode,
        "start_time": config.start_time.isoformat() if config.start_time else None,
        "end_time": config.end_time.isoformat() if config.end_time else None,
        "is_frozen": config.is_frozen,
        "freeze_time": config.freeze_time.isoformat() if config.freeze_time else None,
        "max_teams": config.max_teams,
        "max_members": config.max_members,
        "registration_open": config.registration_open,
        "challenge_slugs": config.challenge_slugs or [],
        "dynamic_scoring": config.dynamic_scoring,
        "first_blood_bonus_pct": config.first_blood_bonus_pct,
        "updated_at": config.updated_at.isoformat(),
    }


class CompetitionConfigView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def get(self, request):
        return Response(_config_to_dict(CompetitionConfig.get_solo()))

    def patch(self, request):
        config = CompetitionConfig.get_solo()

        for str_field in ("name", "description", "mode"):
            if str_field in request.data:
                setattr(config, str_field, str(request.data[str_field]))

        for bool_field in ("competition_mode", "is_frozen", "registration_open", "dynamic_scoring"):
            if bool_field in request.data:
                setattr(config, bool_field, bool(request.data[bool_field]))

        for int_or_none_field in ("max_teams",):
            if int_or_none_field in request.data:
                raw = request.data[int_or_none_field]
                setattr(config, int_or_none_field, int(raw) if raw not in (None, "", "null") else None)

        if "challenge_slugs" in request.data:
            raw = request.data["challenge_slugs"]
            config.challenge_slugs = list(raw) if isinstance(raw, (list, tuple)) else []

        for int_field in ("max_members", "first_blood_bonus_pct"):
            if int_field in request.data:
                setattr(config, int_field, int(request.data[int_field]))

        for dt_field in ("start_time", "end_time", "freeze_time"):
            if dt_field in request.data:
                raw = request.data[dt_field]
                if raw is None or raw == "":
                    setattr(config, dt_field, None)
                else:
                    parsed = parse_datetime(str(raw))
                    if parsed is None:
                        return Response({"detail": f"{dt_field} inválido. Usa ISO 8601."}, status=400)
                    setattr(config, dt_field, parsed)

        config.save()
        log.info("competition_config updated by=%s mode=%s active=%s", request.user.username, config.mode, config.competition_mode)

        try:
            from apps.ws.tasks import broadcast_scoreboard
            broadcast_scoreboard.delay()
        except Exception:
            pass

        return Response(_config_to_dict(config))


class ProfileView(APIView):
    def get(self, request):
        user = request.user
        rank = User.objects.filter(score__gt=user.score).count() + 1

        solves = (
            Solve.objects
            .filter(user=user)
            .select_related("challenge")
            .order_by("-solved_at")
        )

        solve_data = [
            {
                "challenge_slug": s.challenge.slug,
                "challenge_name": s.challenge.name,
                "points": s.points_earned if s.points_earned else s.challenge.points,
                "solved_at": s.solved_at.isoformat(),
            }
            for s in solves
        ]

        hint_slugs = list(
            HintUnlock.objects.filter(user=user).values_list("challenge__slug", flat=True)
        )
        hints_used = len(hint_slugs)
        hints_used_slugs = list(set(hint_slugs))

        total_players = User.objects.filter(score__gt=0).count()
        top3_list = list(
            User.objects.filter(score__gt=0)
            .order_by("-score", "-solved_count")[2:3]
            .values_list("score", flat=True)
        )
        top3_score = int(top3_list[0]) if top3_list else None

        return Response({
            "username": user.username,
            "email": user.email,
            "score": user.score,
            "solved_count": user.solved_count,
            "rank": rank,
            "hints_used": hints_used,
            "hints_used_slugs": hints_used_slugs,
            "total_players": total_players,
            "top3_score": top3_score,
            "solves": solve_data,
            "date_joined": user.date_joined.isoformat(),
        })


class AdminStudentsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.db.models import Q
        from apps.challenges.models import Challenge

        web_slugs    = ["sqli", "cmdi", "xss", "lfi", "path-traversal", "ssti", "idor", "format-string", "jwt", "xxe"]
        crypto_slugs = ["crypto-rsa", "crypto-vigenere"]
        forense_slugs = ["forensics-pcap", "stego"]

        users = (
            User.objects
            .filter(is_staff=False)
            .annotate(
                hints_used_count=Count("hint_unlocks", distinct=True),
                web_solved=Count("solves", filter=Q(solves__challenge__slug__in=web_slugs), distinct=True),
                crypto_solved=Count("solves", filter=Q(solves__challenge__slug__in=crypto_slugs), distinct=True),
                forense_solved=Count("solves", filter=Q(solves__challenge__slug__in=forense_slugs), distinct=True),
            )
            .order_by("-score", "-solved_count", "username")
        )

        total_challenges = Challenge.objects.filter(is_active=True).count()

        return Response({
            "total_challenges": total_challenges,
            "students": [
                {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "score": u.score,
                    "solved_count": u.solved_count,
                    "hints_used": u.hints_used_count,
                    "web_solved": u.web_solved,
                    "crypto_solved": u.crypto_solved,
                    "forense_solved": u.forense_solved,
                    "date_joined": u.date_joined.isoformat(),
                    "rank": idx + 1,
                }
                for idx, u in enumerate(users)
            ],
        })


class CompetitionStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from apps.challenges.models import Solve
        from apps.teams.models import Team

        config = CompetitionConfig.get_solo()
        now = timezone.now()

        # Fase actual
        if not config.competition_mode or not config.start_time:
            phase = "inactive"
        elif now < config.start_time:
            phase = "pending"
        elif config.is_frozen:
            phase = "frozen"
        elif config.end_time and now > config.end_time:
            phase = "ended"
        else:
            phase = "active"

        participant_count = User.objects.filter(score__gt=0, is_staff=False).count()
        team_count = Team.objects.filter(is_banned=False, is_hidden=False).count()
        total_solves = Solve.objects.count()
        solves_last_hour = Solve.objects.filter(
            solved_at__gte=now - timedelta(hours=1)
        ).count()

        recent = (
            Solve.objects
            .select_related("user", "challenge", "user__team_membership__team")
            .order_by("-solved_at")[:10]
        )
        recent_activity = []
        for s in recent:
            team_name = None
            try:
                team_name = s.user.team_membership.team.name
            except Exception:
                pass
            recent_activity.append({
                "username": s.user.username,
                "team_name": team_name,
                "challenge_name": s.challenge.name,
                "challenge_slug": s.challenge.slug,
                "points": s.points_earned,
                "is_first_blood": s.is_first_blood,
                "solved_at": s.solved_at.isoformat(),
            })

        return Response({
            "phase": phase,
            "participant_count": participant_count,
            "team_count": team_count,
            "total_solves": total_solves,
            "solves_last_hour": solves_last_hour,
            "recent_activity": recent_activity,
        })


class ResetScoresView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        with transaction.atomic():
            Solve.objects.all().delete()
            HintUnlock.objects.all().delete()
            User.objects.filter(is_staff=False).update(score=0, solved_count=0)
            try:
                from apps.teams.models import Team
                Team.objects.all().update(score=0, solved_count=0)
            except Exception:
                pass
        log.info("reset_scores by=%s", request.user.username)
        try:
            from apps.ws.tasks import broadcast_scoreboard
            broadcast_scoreboard.delay()
        except Exception:
            pass
        return Response({"message": "Scores, solves y pistas reseteados."})


class ResetTeamsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            from apps.teams.models import Team, TeamMembership
            with transaction.atomic():
                TeamMembership.objects.all().delete()
                Team.objects.all().delete()
        except Exception:
            pass
        log.info("reset_teams by=%s", request.user.username)
        return Response({"message": "Todos los equipos han sido disueltos."})
