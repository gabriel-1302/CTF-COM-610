from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0005_dynamic_scoring"),
    ]

    operations = [
        migrations.AddField(
            model_name="solve",
            name="is_first_blood",
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]
