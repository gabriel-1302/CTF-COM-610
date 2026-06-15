from django.contrib import admin

from . import service
from .models import Instance


@admin.register(Instance)
class InstanceAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "challenge", "status", "host_port", "expires_at", "created_at"]
    list_filter = ["status", "challenge"]
    search_fields = ["user__username", "container_id", "challenge__slug"]
    readonly_fields = ["container_id", "host_port", "created_at", "expires_at"]
    ordering = ["-created_at"]
    actions = ["kill_selected"]

    @admin.action(description="Kill selected instances")
    def kill_selected(self, request, queryset):
        killed = 0
        for inst in queryset:
            service.kill(inst.container_id)
            inst.status = "stopped"
            inst.save(update_fields=["status"])
            killed += 1
        self.message_user(request, f"Killed {killed} instance(s).")
