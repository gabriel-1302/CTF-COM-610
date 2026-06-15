import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Team, TeamMembership, _unique_join_code
from .serializers import (
    CreateTeamSerializer,
    JoinTeamSerializer,
    TeamScoreboardSerializer,
    TeamSerializer,
)

log = logging.getLogger(__name__)


def _get_config():
    from apps.users.models import CompetitionConfig
    return CompetitionConfig.get_solo()


def _get_team(user):
    """Retorna el Team del usuario o None."""
    try:
        return user.team_membership.team
    except TeamMembership.DoesNotExist:
        return None


class TeamCreateView(APIView):
    def post(self, request):
        if _get_team(request.user):
            return Response(
                {"detail": "Ya perteneces a un equipo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cfg = _get_config()
        if not cfg.registration_open:
            return Response(
                {"detail": "El registro de equipos está cerrado."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if cfg.max_teams is not None:
            if Team.objects.filter(is_banned=False).count() >= cfg.max_teams:
                return Response(
                    {"detail": f"Se alcanzó el límite de {cfg.max_teams} equipos para esta competencia."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        ser = CreateTeamSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        with transaction.atomic():
            team = Team.objects.create(
                name=ser.validated_data["name"],
                join_code=_unique_join_code(),
                captain=request.user,
            )
            TeamMembership.objects.create(team=team, user=request.user)

        log.info("team_create name=%s captain=%s", team.name, request.user.id)
        team = Team.objects.prefetch_related("memberships__user").select_related("captain").get(pk=team.pk)
        return Response(TeamSerializer(team).data, status=status.HTTP_201_CREATED)


class TeamJoinView(APIView):
    def post(self, request):
        if _get_team(request.user):
            return Response(
                {"detail": "Ya perteneces a un equipo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cfg = _get_config()
        if not cfg.registration_open:
            return Response(
                {"detail": "El registro de equipos está cerrado."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = JoinTeamSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        code = ser.validated_data["join_code"].upper()
        team = Team.objects.filter(join_code=code, is_banned=False).first()
        if not team:
            return Response({"detail": "Código de invitación inválido."}, status=status.HTTP_404_NOT_FOUND)

        cfg = _get_config()
        max_members = cfg.max_members
        if team.memberships.count() >= max_members:
            return Response(
                {"detail": f"El equipo ya alcanzó el máximo de {max_members} miembros."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TeamMembership.objects.create(team=team, user=request.user)
        log.info("team_join team=%s user=%s", team.id, request.user.id)
        team = Team.objects.prefetch_related("memberships__user").select_related("captain").get(pk=team.pk)
        return Response(TeamSerializer(team).data)


class TeamLookupView(APIView):
    """Retorna info básica de un equipo por código sin unirse."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        code = request.query_params.get("code", "").upper()
        if not code:
            return Response({"detail": "Parámetro 'code' requerido."}, status=status.HTTP_400_BAD_REQUEST)
        team = Team.objects.filter(join_code=code, is_banned=False).first()
        if not team:
            return Response({"detail": "Código inválido."}, status=status.HTTP_404_NOT_FOUND)
        cfg = _get_config()
        return Response({
            "name": team.name,
            "member_count": team.memberships.count(),
            "max_members": cfg.max_members,
        })


class TeamLeaveView(APIView):
    def delete(self, request):
        team = _get_team(request.user)
        if not team:
            return Response({"detail": "No perteneces a un equipo."}, status=status.HTTP_400_BAD_REQUEST)

        is_captain = team.captain_id == request.user.pk
        member_count = team.memberships.count()

        if is_captain and member_count > 1:
            return Response(
                {"detail": "Transfiere el rol de capitán antes de salir."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team_id = team.id
        with transaction.atomic():
            TeamMembership.objects.filter(team=team, user=request.user).delete()
            if member_count == 1:
                team.delete()

        log.info("team_leave team=%s user=%s", team_id, request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamMeView(APIView):
    def get(self, request):
        team = _get_team(request.user)
        if not team:
            return Response({"detail": "No perteneces a un equipo."}, status=status.HTTP_404_NOT_FOUND)

        team = Team.objects.prefetch_related("memberships__user").select_related("captain").get(pk=team.pk)
        return Response(TeamSerializer(team).data)


class TeamScoreboardView(generics.ListAPIView):
    serializer_class = TeamScoreboardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return (
            Team.objects
            .filter(is_hidden=False, is_banned=False)
            .select_related("captain")
            .prefetch_related("memberships")
            .order_by("-score", "-solved_count", "name")[:100]
        )


class TeamKickView(APIView):
    def post(self, request, user_id):
        team = _get_team(request.user)
        if not team:
            return Response({"detail": "No perteneces a un equipo."}, status=status.HTTP_400_BAD_REQUEST)

        if team.captain_id != request.user.pk:
            return Response({"detail": "Solo el capitán puede expulsar miembros."}, status=status.HTTP_403_FORBIDDEN)

        if user_id == request.user.pk:
            return Response({"detail": "No puedes expulsarte a ti mismo."}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = TeamMembership.objects.filter(team=team, user_id=user_id).delete()
        if not deleted:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)

        log.info("team_kick team=%s kicked=%s by=%s", team.id, user_id, request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamTransferView(APIView):
    def post(self, request, user_id):
        team = _get_team(request.user)
        if not team:
            return Response({"detail": "No perteneces a un equipo."}, status=status.HTTP_400_BAD_REQUEST)

        if team.captain_id != request.user.pk:
            return Response({"detail": "Solo el capitán puede transferir el rol."}, status=status.HTTP_403_FORBIDDEN)

        if user_id == request.user.pk:
            return Response({"detail": "Ya eres el capitán."}, status=status.HTTP_400_BAD_REQUEST)

        if not TeamMembership.objects.filter(team=team, user_id=user_id).exists():
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)

        team.captain_id = user_id
        team.save(update_fields=["captain_id"])
        log.info("team_transfer team=%s new_captain=%s by=%s", team.id, user_id, request.user.id)

        team = Team.objects.prefetch_related("memberships__user").select_related("captain").get(pk=team.pk)
        return Response(TeamSerializer(team).data)


# ── Admin ──────────────────────────────────────────────────────────────────────

class AdminTeamsView(generics.ListAPIView):
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return (
            Team.objects
            .prefetch_related("memberships__user")
            .select_related("captain")
            .order_by("-score")
        )


class AdminTeamBanView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            team = Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        team.is_banned = not team.is_banned
        team.save(update_fields=["is_banned"])
        log.info("admin_team_ban team=%s banned=%s by=%s", pk, team.is_banned, request.user.id)
        return Response({"id": team.id, "is_banned": team.is_banned})


class AdminTeamHideView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            team = Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        team.is_hidden = not team.is_hidden
        team.save(update_fields=["is_hidden"])
        return Response({"id": team.id, "is_hidden": team.is_hidden})
