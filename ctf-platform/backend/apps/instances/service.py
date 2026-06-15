import logging

import docker
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from docker.errors import APIError, ImageNotFound, NotFound

log = logging.getLogger(__name__)

# Lazy singleton — not instantiated at import time to avoid startup crash
# when Docker socket is not available (e.g. during testing or migrations).
_client = None


def _get_client():
    global _client
    if _client is None:
        docker_host = getattr(settings, "DOCKER_HOST", None)
        if docker_host:
            _client = docker.DockerClient(base_url=docker_host)
        else:
            # Intentar socket estándar primero; si no existe, probar Docker Desktop
            import os, pathlib
            standard_sock = "/var/run/docker.sock"
            desktop_sock = pathlib.Path.home() / ".docker" / "desktop" / "docker.sock"
            if not pathlib.Path(standard_sock).exists() and desktop_sock.exists():
                _client = docker.DockerClient(base_url=f"unix://{desktop_sock}")
            else:
                _client = docker.from_env()
    return _client


class ChallengeServiceError(Exception):
    """Raised when Docker operations fail — caller translates to HTTP 500."""
    pass


def _mem_limit_for(challenge) -> str:
    """XSS challenge runs a full Chromium bot — needs extra memory."""
    if challenge.slug == "xss":
        return settings.INSTANCE_MEM_LIMIT_XSS
    return settings.INSTANCE_MEM_LIMIT_DEFAULT


def spawn(challenge, user) -> tuple[str, int, object]:
    """
    Launch a sandboxed Docker container for the given challenge and user.

    Returns: (container_id, host_port, expires_at)
    Raises: ChallengeServiceError on any Docker failure.
    """
    expires_at = timezone.now() + timedelta(minutes=settings.INSTANCE_TTL_MINUTES)

    try:
        container = _get_client().containers.run(
            image=challenge.image_name,
            detach=True,
            ports={f"{challenge.internal_port}/tcp": None},  # None = ephemeral host port
            network=settings.DOCKER_NETWORK,
            mem_limit=_mem_limit_for(challenge),
            memswap_limit=_mem_limit_for(challenge),  # prevent swap usage (disk I/O saturation)
            cpu_quota=settings.INSTANCE_CPU_QUOTA,
            cpu_period=settings.INSTANCE_CPU_PERIOD,
            pids_limit=100,                             # prevent fork bombs
            security_opt=["no-new-privileges:true"],
            cap_drop=["ALL"],                           # drop all Linux capabilities
            read_only=False,                            # SQLi writes to SQLite
            tmpfs={"/tmp": "size=32m"},                 # ephemeral tmp in RAM
            labels={
                "ctf.managed": "true",
                "ctf.user_id": str(user.id),
                "ctf.challenge": challenge.slug,
                "ctf.expires_ts": str(int(expires_at.timestamp())),
            },
            auto_remove=False,  # we control removal — needed to mark FAILED in DB
        )
    except ImageNotFound:
        raise ChallengeServiceError(f"Image '{challenge.image_name}' not found on host")
    except APIError as e:
        raise ChallengeServiceError(f"Docker API error: {e}")
    except Exception as e:
        raise ChallengeServiceError(f"Error de conexión con Docker: {e}")

    # Esperar/reintentar a que Docker asigne y propague el puerto mapeado
    import time
    host_port = None
    for attempt in range(5):
        try:
            container.reload()
            port_key = f"{challenge.internal_port}/tcp"
            ports = container.ports.get(port_key) or []
            if ports and isinstance(ports, list) and ports[0].get("HostPort"):
                host_port = int(ports[0]["HostPort"])
                break
        except Exception as e:
            log.warning("Intentando recargar puertos del contenedor (intento %s): %s", attempt + 1, e)
        time.sleep(0.5)

    if not host_port:
        # El contenedor arrancó pero no se asignó puerto; lo limpiamos y fallamos limpiamente
        try:
            container.remove(force=True)
        except Exception:
            pass
        raise ChallengeServiceError("El contenedor inició pero no se asignó un puerto público a tiempo.")

    log.info(
        "spawned container=%s challenge=%s user=%s port=%s expires=%s",
        container.short_id,
        challenge.slug,
        user.id,
        host_port,
        expires_at.isoformat(),
    )
    return container.id, host_port, expires_at


def kill(container_id: str) -> bool:
    """
    Remove a container by ID.

    Returns True if it existed and was removed, False if already gone.
    """
    if not container_id:
        return False
    try:
        c = _get_client().containers.get(container_id)
        c.remove(force=True, v=True)  # v=True cleans anonymous volumes
        log.info("killed container=%s", container_id[:12])
        return True
    except NotFound:
        return False
    except APIError as e:
        log.warning("kill failed container=%s err=%s", container_id[:12], e)
        return False


def check_healthy(container_id: str) -> bool:
    """Check if a container is healthy/running."""
    try:
        c = _get_client().containers.get(container_id)
        state = c.attrs.get("State", {})
        health = state.get("Health", {}).get("Status")
        if health is None:
            # No healthcheck configured — trust 'running' status
            return state.get("Status") == "running"
        return health == "healthy"
    except NotFound:
        return False
