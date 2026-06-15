from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name="user",
            name="users_user_score_4d3e7b_idx",
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(
                fields=["-score", "-solved_count", "username"],
                name="user_scoreboard_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["score"], name="user_score_filter_idx"),
        ),
    ]
