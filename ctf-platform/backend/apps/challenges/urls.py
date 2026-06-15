from django.urls import path

from .views import AdminChallengeToggleView, AdminChallengesView, AdminChallengeSolucionarioView, ChallengeDetailView, ChallengeListView, SubmitFlagView, UnlockHintView

urlpatterns = [
    path("", ChallengeListView.as_view(), name="challenge-list"),
    path("admin/", AdminChallengesView.as_view(), name="admin-challenges"),
    path("admin/<slug:slug>/toggle/", AdminChallengeToggleView.as_view(), name="admin-challenge-toggle"),
    path("admin/<slug:slug>/solucionario/", AdminChallengeSolucionarioView.as_view(), name="admin-challenge-solucionario"),
    path("<slug:slug>/", ChallengeDetailView.as_view(), name="challenge-detail"),
    path("<slug:slug>/submit/", SubmitFlagView.as_view(), name="challenge-submit"),
    path("<slug:slug>/hints/<int:index>/unlock/", UnlockHintView.as_view(), name="hint-unlock"),
]
