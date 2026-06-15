import secrets

from django.conf import settings
from django.db import models


def _unique_join_code():
    """Genera código hex de 8 chars, garantiza unicidad."""
    for _ in range(10):
        code = secrets.token_hex(4).upper()
        if not Team.objects.filter(join_code=code).exists():
            return code
    raise RuntimeError("No se pudo generar join_code único")


class Team(models.Model):
    name = models.CharField(max_length=64, unique=True)
    join_code = models.CharField(max_length=8, unique=True)
    captain = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="led_teams",
    )
    score = models.PositiveIntegerField(default=0)
    solved_count = models.PositiveIntegerField(default=0)
    is_banned = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["-score", "-solved_count", "name"], name="team_scoreboard_idx"),
        ]

    def __str__(self):
        return f"{self.name} (score={self.score})"


class TeamMembership(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="team_membership",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} → {self.team.name}"
