from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_competition_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='competitionconfig',
            name='start_time',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Inicio de competencia'),
        ),
        migrations.AddField(
            model_name='competitionconfig',
            name='end_time',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fin de competencia'),
        ),
    ]
