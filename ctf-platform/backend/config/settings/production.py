from .base import *  # noqa: F401, F403

DEBUG = False
ALLOWED_HOSTS = list(config("ALLOWED_HOSTS", cast=Csv(), default="localhost,127.0.0.1")) + ["backend", "localhost", "127.0.0.1"]  # noqa: F405

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB"),  # noqa: F405
        "USER": config("POSTGRES_USER"),  # noqa: F405
        "PASSWORD": config("POSTGRES_PASSWORD"),  # noqa: F405
        "HOST": config("POSTGRES_HOST", default="db"),  # noqa: F405
        "PORT": config("POSTGRES_PORT", default="5432"),  # noqa: F405
        "CONN_MAX_AGE": 600,
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

CORS_ALLOWED_ORIGINS = config("CORS_ORIGINS", cast=Csv())  # noqa: F405
CORS_ALLOW_CREDENTIALS = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
