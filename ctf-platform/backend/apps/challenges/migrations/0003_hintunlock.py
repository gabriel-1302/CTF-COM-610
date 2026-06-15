import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="HintUnlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hint_index", models.PositiveSmallIntegerField()),
                ("unlocked_at", models.DateTimeField(auto_now_add=True)),
                ("challenge", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="challenges.challenge")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hint_unlocks", to=settings.AUTH_USER_MODEL)),
            ],
            options={"unique_together": {("user", "challenge", "hint_index")}},
        ),
        migrations.AddIndex(
            model_name="hintunlock",
            index=models.Index(fields=["user", "challenge"], name="challenges_hintunl_user_id_idx"),
        ),
    ]
