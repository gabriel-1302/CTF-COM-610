import logging

from celery import shared_task
from django.utils import timezone

from . import service
from .models import Instance

log = logging.getLogger(__name__)


@shared_task
def cleanup_expired_instances():
    """
    Kill containers whose TTL has passed and mark them EXPIRED.
    Runs every 60s (configured in CELERY_BEAT_SCHEDULE).
    Uses indexed query: (status, expires_at).
    """
    now = timezone.now()
    qs = Instance.objects.filter(
        status__in=["pending", "running"],
        expires_at__lte=now,
    )

    expired_ids = []
    for inst in qs.iterator():
        try:
            service.kill(inst.container_id)
        except Exception:
            log.exception("cleanup: kill failed inst=%s container=%s", inst.id, inst.container_id[:12])
        expired_ids.append(inst.id)

    if expired_ids:
        Instance.objects.filter(id__in=expired_ids).update(status=Instance.Status.EXPIRED)
        log.info("cleanup: expired=%s instances", len(expired_ids))


@shared_task
def reconcile_orphan_containers():
    """
    Find Docker containers with label ctf.managed=true that have no corresponding
    active Instance in the DB. This catches containers spawned during a worker crash
    between spawn() and the DB update.
    Runs every 5min.
    """
    import docker

    client = docker.from_env()

    known_ids = set(
        Instance.objects.filter(
            status__in=["pending", "running"]
        ).values_list("container_id", flat=True)
    )

    orphan_count = 0
    for c in client.containers.list(filters={"label": "ctf.managed=true"}):
        if c.id not in known_ids:
            log.warning("reconcile: orphan container found id=%s — killing", c.short_id)
            try:
                c.remove(force=True)
                orphan_count += 1
            except Exception:
                log.exception("reconcile: orphan kill failed id=%s", c.short_id)

    if orphan_count:
        log.info("reconcile: killed %s orphan containers", orphan_count)
