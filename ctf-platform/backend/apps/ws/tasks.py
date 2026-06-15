from celery import shared_task


@shared_task
def broadcast_first_blood(challenge_slug, challenge_name, username, team_name, points_earned):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            "scoreboard",
            {
                "type": "first_blood",
                "challenge_slug": challenge_slug,
                "challenge_name": challenge_name,
                "username": username,
                "team_name": team_name,
                "points_earned": points_earned,
            },
        )


@shared_task
def broadcast_scoreboard():
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from django.contrib.auth import get_user_model
    from django.db.models import Count, Sum

    from apps.users.models import CompetitionConfig

    User = get_user_model()
    config = CompetitionConfig.get_solo()

    if config.is_frozen and config.freeze_time:
        from apps.challenges.models import Solve
        rows = (
            Solve.objects
            .filter(solved_at__lte=config.freeze_time)
            .values("user__username")
            .annotate(score=Sum("points_earned"), solved_count=Count("id"))
            .order_by("-score", "-solved_count", "user__username")[:100]
        )
        entries = [
            {
                "username": r["user__username"],
                "score": r["score"] or 0,
                "solved_count": r["solved_count"],
            }
            for r in rows
        ]
    else:
        entries = list(
            User.objects
            .filter(score__gt=0)
            .order_by("-score", "-solved_count", "username")
            .values("username", "score", "solved_count")[:100]
        )

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            "scoreboard",
            {
                "type": "scoreboard_update",
                "entries": entries,
                "frozen": config.is_frozen,
                "freeze_time": config.freeze_time.isoformat() if config.freeze_time else None,
            },
        )
