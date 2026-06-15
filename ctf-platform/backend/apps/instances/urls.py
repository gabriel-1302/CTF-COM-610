from django.urls import path

from .views import ActiveInstancesView, KillView, SpawnView

urlpatterns = [
    path("spawn/", SpawnView.as_view(), name="instance-spawn"),
    path("active/", ActiveInstancesView.as_view(), name="instance-active"),
    path("<int:pk>/", KillView.as_view(), name="instance-kill"),
]
