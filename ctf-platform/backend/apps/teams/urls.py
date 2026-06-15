from django.urls import path

from . import views

urlpatterns = [
    # Jugador
    path("", views.TeamCreateView.as_view(), name="team-create"),
    path("join/", views.TeamJoinView.as_view(), name="team-join"),
    path("leave/", views.TeamLeaveView.as_view(), name="team-leave"),
    path("me/", views.TeamMeView.as_view(), name="team-me"),
    path("lookup/", views.TeamLookupView.as_view(), name="team-lookup"),
    path("scoreboard/", views.TeamScoreboardView.as_view(), name="team-scoreboard"),
    path("kick/<int:user_id>/", views.TeamKickView.as_view(), name="team-kick"),
    path("transfer/<int:user_id>/", views.TeamTransferView.as_view(), name="team-transfer"),
    # Admin
    path("admin/", views.AdminTeamsView.as_view(), name="admin-teams"),
    path("admin/<int:pk>/ban/", views.AdminTeamBanView.as_view(), name="admin-team-ban"),
    path("admin/<int:pk>/hide/", views.AdminTeamHideView.as_view(), name="admin-team-hide"),
]
