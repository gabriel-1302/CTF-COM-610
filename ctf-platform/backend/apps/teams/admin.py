from django.contrib import admin

from .models import Team, TeamMembership


class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 0
    readonly_fields = ["user", "joined_at"]
    can_delete = True


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "captain", "score", "solved_count", "member_count", "is_banned", "is_hidden", "created_at"]
    list_filter = ["is_banned", "is_hidden"]
    search_fields = ["name", "captain__username"]
    readonly_fields = ["join_code", "score", "solved_count", "created_at"]
    inlines = [TeamMembershipInline]
    actions = ["ban_teams", "unban_teams"]

    def member_count(self, obj):
        return obj.memberships.count()
    member_count.short_description = "Miembros"

    @admin.action(description="Banear equipos seleccionados")
    def ban_teams(self, request, queryset):
        queryset.update(is_banned=True)

    @admin.action(description="Desbanear equipos seleccionados")
    def unban_teams(self, request, queryset):
        queryset.update(is_banned=False)


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "team", "joined_at"]
    search_fields = ["user__username", "team__name"]
    readonly_fields = ["joined_at"]
