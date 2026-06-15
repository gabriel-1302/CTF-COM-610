from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import CompetitionConfig

User = get_user_model()


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["id", "username", "email", "score", "solved_count", "is_staff", "date_joined"]
    list_filter = ["is_staff", "is_active"]
    search_fields = ["username", "email"]
    ordering = ["-score"]
    readonly_fields = ["date_joined", "last_login"]


@admin.register(CompetitionConfig)
class CompetitionConfigAdmin(admin.ModelAdmin):
    list_display = ["id", "is_frozen", "freeze_time", "updated_at"]
    readonly_fields = ["updated_at"]

    def has_add_permission(self, request):
        return not CompetitionConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
