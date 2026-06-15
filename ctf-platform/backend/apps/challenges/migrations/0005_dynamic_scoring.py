from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0004_perf_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="challenge",
            name="min_points",
            field=models.PositiveIntegerField(default=50),
        ),
        migrations.AddField(
            model_name="challenge",
            name="decay",
            field=models.PositiveIntegerField(default=20),
        ),
        migrations.AddField(
            model_name="solve",
            name="points_earned",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
