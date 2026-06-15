from django.conf import settings
from django.db import models
from django.utils import timezone


class Instance(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"   # docker.containers.run llamado, aún no healthy
        RUNNING = "running"   # healthy, URL expuesta al usuario
        STOPPED = "stopped"   # matada manualmente por el usuario
        EXPIRED = "expired"   # matada por cleanup TTL
        FAILED  = "failed"    # el container nunca arrancó

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="instances",
    )
    challenge = models.ForeignKey(
        "challenges.Challenge",
        on_delete=models.CASCADE,
        related_name="instances",
    )
    container_id = models.CharField(max_length=64, blank=True)
    host_port = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            # Partial unique index: only ONE active (pending/running) instance per user+challenge.
            # Allows re-spawning after expiration or manual kill.
            models.UniqueConstraint(
                fields=["user", "challenge"],
                condition=models.Q(status__in=["pending", "running"]),
                name="one_active_instance_per_user_challenge",
            )
        ]
        indexes = [
            models.Index(fields=["status", "expires_at"]),  # cleanup query
            models.Index(fields=["user", "status"]),         # active instances per user
        ]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"Instance #{self.id} [{self.challenge.slug}] user={self.user_id} status={self.status}"
