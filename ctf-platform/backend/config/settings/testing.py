"""
Test-specific settings override.
Disables Django's internal traceback template rendering (breaks on Python 3.14 + Django 5.0).
"""
from .development import *  # noqa: F401, F403

# Disable Django's AdminEmailHandler and verbose traceback logging
# that triggers a Python 3.14 incompatibility with Django 5.0's TemplateContext.__copy__
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.request": {
            "handlers": [],
            "level": "CRITICAL",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

# Use in-memory cache during tests — avoids Redis dependency
# django-ratelimit uses the cache backend to track request counters
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "ctf-test-cache",
    }
}
