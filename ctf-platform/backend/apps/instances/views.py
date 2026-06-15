import logging
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response

from apps.challenges.models import Challenge
from . import service
from .models import Instance
from .serializers import InstanceSerializer

log = logging.getLogger(__name__)


class SpawnView(generics.GenericAPIView):
    """
    POST /api/instances/spawn/
    Body: {"challenge_slug": "sqli"}

    Order matters:
    1. Create Instance with PENDING status (DB lock via UniqueConstraint)
    2. Call Docker to start container
    3. Update Instance to RUNNING with container_id and port
    If step 2 fails, mark FAILED — no orphan containers.
    """
    serializer_class = InstanceSerializer

    def post(self, request):
        slug = request.data.get("challenge_slug")
        if not slug:
            return Response(
                {"detail": "challenge_slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

        # Check global active instance limit for this user
        active_count = Instance.objects.filter(
            user=request.user, status__in=["pending", "running"]
        ).count()
        if active_count >= settings.MAX_ACTIVE_INSTANCES_PER_USER:
            return Response(
                {"detail": f"Máximo {settings.MAX_ACTIVE_INSTANCES_PER_USER} instancias activas permitidas"},
                status=status.HTTP_409_CONFLICT,
            )

        # Create PENDING instance BEFORE calling Docker.
        # This respects UniqueConstraint and serves as a logical lock.
        try:
            instance = Instance.objects.create(
                user=request.user,
                challenge=challenge,
                expires_at=timezone.now() + timedelta(minutes=settings.INSTANCE_TTL_MINUTES),
                status=Instance.Status.PENDING,
            )
        except IntegrityError:
            return Response(
                {"detail": "Ya tienes una instancia activa de este challenge"},
                status=status.HTTP_409_CONFLICT,
            )

        # Launch the Docker container
        try:
            cid, port, expires_at = service.spawn(challenge, request.user)
        except service.ChallengeServiceError as e:
            log.error("spawn failed challenge=%s user=%s err=%s", slug, request.user.id, e)
            instance.status = Instance.Status.FAILED
            instance.save(update_fields=["status"])
            return Response(
                {"detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        instance.container_id = cid
        instance.host_port = port
        instance.expires_at = expires_at
        instance.status = Instance.Status.RUNNING
        instance.save(update_fields=["container_id", "host_port", "expires_at", "status"])

        serializer = InstanceSerializer(instance, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class KillView(generics.DestroyAPIView):
    """DELETE /api/instances/{id}/ — Kill a running instance."""

    def get_queryset(self):
        # Users can only kill their own instances
        return Instance.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        service.kill(instance.container_id)
        instance.status = Instance.Status.STOPPED
        instance.save(update_fields=["status"])
        # Keep the row for history — do NOT delete


class ActiveInstancesView(generics.ListAPIView):
    """GET /api/instances/active/ — List user's pending+running instances."""
    serializer_class = InstanceSerializer

    def get_queryset(self):
        return (
            Instance.objects.filter(
                user=self.request.user,
                status__in=["pending", "running"],
            )
            .select_related("challenge")
            .order_by("-created_at")
        )
