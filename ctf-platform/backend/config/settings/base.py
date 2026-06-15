from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SECRET_KEY = config("DJANGO_SECRET_KEY", default="dev-only-insecure-key-change-in-prod")
AUTH_USER_MODEL = "users.User"  # crítico: antes de la primera migración

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "apps.users",
    "apps.challenges",
    "apps.instances",
    "apps.ws",
    "apps.teams",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # antes de CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── DRF ──────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": config("JWT_SIGNING_KEY", default=SECRET_KEY),
}

# ── Redis / Cache ─────────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://localhost:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# ── Django Channels ───────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [config("REDIS_URL", default="redis://localhost:6379/1")],
        },
    }
}

# ── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300
CELERY_BEAT_SCHEDULE = {
    "cleanup-expired-instances": {
        "task": "apps.instances.tasks.cleanup_expired_instances",
        "schedule": 60.0,  # cada 60 segundos
    },
    "reconcile-orphan-containers": {
        "task": "apps.instances.tasks.reconcile_orphan_containers",
        "schedule": 300.0,  # cada 5 minutos
    },
}

# ── Docker / Instances ────────────────────────────────────────────────────────
DOCKER_HOST = config("DOCKER_HOST", default="")
DOCKER_NETWORK = config("DOCKER_NETWORK", default="ctf-challenges-net")
INSTANCE_TTL_MINUTES = config("INSTANCE_TTL_MINUTES", default=30, cast=int)
INSTANCE_MEM_LIMIT_DEFAULT = "128m"
INSTANCE_MEM_LIMIT_XSS = "512m"  # Chromium necesita más
INSTANCE_CPU_QUOTA = 50000       # 50% de un core
INSTANCE_CPU_PERIOD = 100000
MAX_ACTIVE_INSTANCES_PER_USER = 3

PUBLIC_HOSTNAME = config("PUBLIC_HOSTNAME", default="localhost")
INSTANCE_URL_PATTERN = config("INSTANCE_URL_PATTERN", default="")

# ── Modo Competencia ──────────────────────────────────────────────────────────
# True: scoring por equipos, deduplicación de solves por equipo
# False: scoring individual (modo entrenamiento)
COMPETITION_MODE = config("COMPETITION_MODE", default=False, cast=bool)
TEAM_MAX_MEMBERS = config("TEAM_MAX_MEMBERS", default=5, cast=int)
# Puntuación dinámica: puntos decaen según cuántos equipos/users resuelven el reto
DYNAMIC_SCORING = config("DYNAMIC_SCORING", default=False, cast=bool)
# Bonus de puntos al primer solver (porcentaje sobre current_points)
# 0 = solo reconocimiento visual, sin puntos extra
FIRST_BLOOD_BONUS_PCT = config("FIRST_BLOOD_BONUS_PCT", default=0, cast=int)

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "apps.instances": {"handlers": ["console"], "level": "INFO"},
        "apps.challenges": {"handlers": ["console"], "level": "INFO"},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}
