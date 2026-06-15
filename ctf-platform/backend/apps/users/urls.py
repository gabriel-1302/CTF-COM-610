from django.urls import path

from .views import (
    AdminStudentsView,
    CompetitionConfigView,
    CompetitionStatsView,
    CookieTokenRefreshView,
    LoginView,
    LogoutView,
    MeView,
    ProfileView,
    RegisterView,
    RegistrationStatusView,
    ResetScoresView,
    ResetTeamsView,
    ScoreboardView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("registration-status/", RegistrationStatusView.as_view(), name="auth-registration-status"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("scoreboard/", ScoreboardView.as_view(), name="scoreboard"),
    path("competition/", CompetitionConfigView.as_view(), name="competition-config"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("admin/students/", AdminStudentsView.as_view(), name="admin-students"),
    path("admin/competition/stats/", CompetitionStatsView.as_view(), name="admin-competition-stats"),
    path("admin/reset/scores/", ResetScoresView.as_view(), name="admin-reset-scores"),
    path("admin/reset/teams/", ResetTeamsView.as_view(), name="admin-reset-teams"),
]
