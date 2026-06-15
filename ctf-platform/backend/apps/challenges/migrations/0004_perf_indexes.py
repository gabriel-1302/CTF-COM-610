from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0003_hintunlock"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="challenge",
            index=models.Index(fields=["is_active"], name="challenge_is_active_idx"),
        ),
    ]
