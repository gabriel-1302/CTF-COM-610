import hashlib
import hmac

from django.conf import settings
from django.db import models


class Challenge(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField()
    # `points` = valor inicial (y valor fijo cuando DYNAMIC_SCORING=False)
    points = models.PositiveIntegerField()
    # Dynamic scoring: puntos bajan conforme más solvers lo resuelven
    min_points = models.PositiveIntegerField(default=50)
    decay = models.PositiveIntegerField(default=20)  # solves para llegar al mínimo
    image_name = models.CharField(max_length=100)
    flag_hash = models.CharField(max_length=64)
    internal_port = models.PositiveIntegerField()
    hints = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def compute_points(self, solve_count: int) -> int:
        """Fórmula cuadrática CTFd: decae de points→min_points en `decay` solves."""
        if not getattr(settings, "DYNAMIC_SCORING", False):
            return self.points
        if self.decay <= 0 or self.min_points >= self.points:
            return self.points
        value = (
            ((self.min_points - self.points) / (self.decay ** 2)) * (solve_count ** 2)
            + self.points
        )
        return max(self.min_points, int(round(value)))

    def verify(self, flag: str) -> bool:
        candidate = hashlib.sha256(flag.strip().encode()).hexdigest()
        return hmac.compare_digest(candidate, self.flag_hash)

    class Meta:
        ordering = ["points"]
        indexes = [
            models.Index(fields=["is_active"], name="challenge_is_active_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.points}pts)"


class Solve(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="solves",
    )
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    points_earned = models.PositiveIntegerField(default=0)
    is_first_blood = models.BooleanField(default=False, db_index=True)
    solved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "challenge")
        indexes = [models.Index(fields=["user", "challenge"])]

    def __str__(self):
        fb = " 🩸" if self.is_first_blood else ""
        return f"{self.user.username} solved {self.challenge.slug} (+{self.points_earned}pts){fb}"


class HintUnlock(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hint_unlocks",
    )
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    hint_index = models.PositiveSmallIntegerField()
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "challenge", "hint_index")
        indexes = [models.Index(fields=["user", "challenge"])]

    def __str__(self):
        return f"{self.user.username} unlocked hint {self.hint_index} on {self.challenge.slug}"
