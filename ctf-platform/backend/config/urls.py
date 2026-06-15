from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/challenges/", include("apps.challenges.urls")),
    path("api/instances/", include("apps.instances.urls")),
    path("api/teams/", include("apps.teams.urls")),
]
