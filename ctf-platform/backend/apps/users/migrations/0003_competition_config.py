from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_perf_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompetitionConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("is_frozen", models.BooleanField(default=False)),
                ("freeze_time", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuración de competencia",
            },
        ),
    ]
