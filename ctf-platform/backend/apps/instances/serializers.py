from django.utils import timezone
from rest_framework import serializers

from .models import Instance


class InstanceSerializer(serializers.ModelSerializer):
    challenge_slug = serializers.CharField(source="challenge.slug", read_only=True)
    challenge_name = serializers.CharField(source="challenge.name", read_only=True)
    url = serializers.SerializerMethodField()
    ttl_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Instance
        fields = [
            "id",
            "challenge_slug",
            "challenge_name",
            "status",
            "host_port",
            "url",
            "created_at",
            "expires_at",
            "ttl_seconds",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        from django.conf import settings
        if obj.host_port:
            if settings.INSTANCE_URL_PATTERN:
                return settings.INSTANCE_URL_PATTERN.format(port=obj.host_port)
            if settings.PUBLIC_HOSTNAME == "server-244.rootcode.com.bo":
                return f"http://server-244.rootcode.com.bo/{obj.host_port}/"
            return f"http://{settings.PUBLIC_HOSTNAME}:{obj.host_port}"
        return None

    def get_ttl_seconds(self, obj):
        remaining = (obj.expires_at - timezone.now()).total_seconds()
        return max(0, int(remaining))
