from django.contrib.auth.models import AbstractUser
from django.db import models


class CompetitionConfig(models.Model):
    """Singleton (pk=1) — configuración global de la competencia."""

    MODE_INDIVIDUAL = "individual"
    MODE_TEAMS = "teams"
    MODE_MIXED = "mixed"
    MODE_CHOICES = [
        (MODE_INDIVIDUAL, "Individual"),
        (MODE_TEAMS, "Equipos"),
        (MODE_MIXED, "Mixto (Individual + Equipos)"),
    ]

    # Identidad
    name = models.CharField(max_length=120, default="CTF USFX", verbose_name="Nombre de la competencia")
    description = models.TextField(blank=True, default="", verbose_name="Descripción")

    # Estado
    competition_mode = models.BooleanField(default=False, verbose_name="Modo competencia activo")
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_TEAMS, verbose_name="Modalidad")

    # Tiempo
    start_time = models.DateTimeField(null=True, blank=True, verbose_name="Inicio")
    end_time = models.DateTimeField(null=True, blank=True, verbose_name="Fin")
    is_frozen = models.BooleanField(default=False)
    freeze_time = models.DateTimeField(null=True, blank=True)

    # Equipos
    max_teams = models.PositiveIntegerField(null=True, blank=True, verbose_name="Máximo de equipos (null = ilimitado)")
    max_members = models.PositiveIntegerField(default=5, verbose_name="Máximo de miembros por equipo")
    registration_open = models.BooleanField(default=True, verbose_name="Registro de equipos siempre abierto")

    # Retos seleccionados (lista de slugs; vacío = todos los activos)
    challenge_slugs = models.JSONField(default=list, blank=True, verbose_name="Retos incluidos en la competencia")

    # Scoring
    dynamic_scoring = models.BooleanField(default=False, verbose_name="Scoring dinámico")
    first_blood_bonus_pct = models.PositiveIntegerField(default=0, verbose_name="Bonus first blood (%)")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de competencia"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        state = f"FROZEN at {self.freeze_time}" if self.is_frozen else "live"
        return f"CompetitionConfig [{self.name}] ({state})"


class User(AbstractUser):
    email = models.EmailField(unique=True)
    score = models.PositiveIntegerField(default=0)
    solved_count = models.PositiveIntegerField(default=0)

    REQUIRED_FIELDS = ["email"]

    class Meta:
        indexes = [
            models.Index(fields=["-score", "-solved_count", "username"], name="user_scoreboard_idx"),
            models.Index(fields=["score"], name="user_score_filter_idx"),
        ]

    def __str__(self):
        return f"{self.username} (score={self.score})"
