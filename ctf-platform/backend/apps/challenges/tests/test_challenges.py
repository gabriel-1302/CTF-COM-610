"""
Tests críticos para app challenges.
"""
import hashlib
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from apps.challenges.models import Challenge, Solve
from apps.instances.models import Instance
from apps.tests.factories import ChallengeFactory, UserFactory


# ─────────────────────────────────────────────────────────────
# 1. Flag verification
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_verify_correct_flag():
    ch = ChallengeFactory(flag_hash=hashlib.sha256(b"CTF{ok}").hexdigest())
    assert ch.verify("CTF{ok}") is True


@pytest.mark.django_db
def test_verify_wrong_flag():
    ch = ChallengeFactory(flag_hash=hashlib.sha256(b"CTF{ok}").hexdigest())
    assert ch.verify("CTF{bad}") is False


@pytest.mark.django_db
def test_verify_strips_whitespace():
    ch = ChallengeFactory(flag_hash=hashlib.sha256(b"CTF{ok}").hexdigest())
    assert ch.verify("  CTF{ok}  ") is True


# ─────────────────────────────────────────────────────────────
# 2. Submit flag endpoint
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_submit_correct_flag(auth_client, user, challenge):
    resp = auth_client.post(
        f"/api/challenges/{challenge.slug}/submit/",
        {"flag": "CTF{test_flag}"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["correct"] is True
    assert resp.data["points_earned"] == 100
    user.refresh_from_db()
    assert user.score == 100
    assert user.solved_count == 1


@pytest.mark.django_db
def test_submit_wrong_flag(auth_client, user, challenge):
    resp = auth_client.post(
        f"/api/challenges/{challenge.slug}/submit/",
        {"flag": "CTF{wrong}"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["correct"] is False
    user.refresh_from_db()
    assert user.score == 0


@pytest.mark.django_db
def test_submit_twice_does_not_double_score(auth_client, user, challenge):
    """Idempotencia: resolver dos veces no duplica el score."""
    # Primera vez
    r1 = auth_client.post(
        f"/api/challenges/{challenge.slug}/submit/",
        {"flag": "CTF{test_flag}"},
        format="json",
    )
    assert r1.status_code == 200 and r1.data["correct"] is True
    user.refresh_from_db()
    assert user.score == 100

    # Segunda vez
    r2 = auth_client.post(
        f"/api/challenges/{challenge.slug}/submit/",
        {"flag": "CTF{test_flag}"},
        format="json",
    )
    assert r2.status_code == 400  # Already solved
    user.refresh_from_db()
    assert user.score == 100  # Sin cambio


# ─────────────────────────────────────────────────────────────
# 3. Max concurrent instances
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_max_concurrent_instances(auth_client, user):
    """4to spawn es rechazado cuando ya hay 3 instancias activas."""
    challenges = [
        ChallengeFactory(slug=f"ch{i}", image_name="ctf-sqli:latest", internal_port=5000)
        for i in range(3)
    ]
    for ch in challenges:
        Instance.objects.create(
            user=user,
            challenge=ch,
            status="running",
            expires_at=timezone.now() + timedelta(minutes=30),
        )

    extra_ch = ChallengeFactory(slug="extra", image_name="ctf-sqli:latest", internal_port=5000)
    resp = auth_client.post(
        "/api/instances/spawn/",
        {"challenge_slug": extra_ch.slug},
        format="json",
    )
    assert resp.status_code == 409


# ─────────────────────────────────────────────────────────────
# 4. Spawn con Docker mockeado
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
@patch("apps.instances.service._get_client")
def test_spawn_creates_instance_with_security_flags(mock_get_client, user, challenge):
    """Verifica que spawn pasa los flags de seguridad al SDK de Docker."""
    fake_container = MagicMock()
    fake_container.id = "abc123deadbeef"
    fake_container.short_id = "abc123"
    fake_container.ports = {"5000/tcp": [{"HostPort": "32768"}]}

    mock_client_instance = MagicMock()
    mock_client_instance.containers.run.return_value = fake_container
    mock_get_client.return_value = mock_client_instance

    from apps.instances import service
    cid, port, exp = service.spawn(challenge, user)

    assert cid == "abc123deadbeef"
    assert port == 32768
    mock_client_instance.containers.run.assert_called_once()

    kwargs = mock_client_instance.containers.run.call_args.kwargs
    assert kwargs["cap_drop"] == ["ALL"]
    assert "no-new-privileges:true" in kwargs["security_opt"]
    assert kwargs["pids_limit"] == 100
    assert kwargs["mem_limit"] is not None
    assert kwargs["labels"]["ctf.managed"] == "true"
    assert kwargs["labels"]["ctf.challenge"] == challenge.slug


# ─────────────────────────────────────────────────────────────
# 5. Cleanup de instancias expiradas
# ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
@patch("apps.instances.tasks.service.kill")
def test_cleanup_kills_expired_instances(mock_kill, user, challenge):
    """Cleanup marca EXPIRED e invoca kill para cada instancia caducada."""
    from freezegun import freeze_time
    from apps.instances.tasks import cleanup_expired_instances

    with freeze_time("2025-01-01 10:00:00"):
        inst = Instance.objects.create(
            user=user,
            challenge=challenge,
            container_id="deadbeef123",
            status="running",
            expires_at=timezone.now() + timedelta(minutes=30),
        )

    with freeze_time("2025-01-01 10:31:00"):
        cleanup_expired_instances()

    mock_kill.assert_called_once_with("deadbeef123")
    inst.refresh_from_db()
    assert inst.status == "expired"


@pytest.mark.django_db
@patch("apps.instances.tasks.service.kill")
def test_cleanup_skips_non_expired(mock_kill, user, challenge):
    """Cleanup no mata instancias que aún no han expirado."""
    from freezegun import freeze_time
    from apps.instances.tasks import cleanup_expired_instances

    with freeze_time("2025-01-01 10:00:00"):
        Instance.objects.create(
            user=user,
            challenge=challenge,
            container_id="alive123",
            status="running",
            expires_at=timezone.now() + timedelta(minutes=30),
        )

    with freeze_time("2025-01-01 10:15:00"):  # only 15min passed
        cleanup_expired_instances()

    mock_kill.assert_not_called()
