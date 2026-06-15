from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum, Count

from apps.teams.models import Team
from apps.challenges.models import Solve


class Command(BaseCommand):
    help = "Recalcula score y solved_count de todos los equipos desde los Solve existentes."

    def handle(self, *args, **options):
        teams = Team.objects.all()
        updated = 0

        with transaction.atomic():
            for team in teams:
                agg = Solve.objects.filter(
                    user__team_membership__team=team
                ).aggregate(
                    total_points=Sum("points_earned"),
                    total_solves=Count("id"),
                )
                score = agg["total_points"] or 0
                solved_count = agg["total_solves"] or 0

                Team.objects.filter(pk=team.pk).update(
                    score=score,
                    solved_count=solved_count,
                )
                self.stdout.write(f"  {team.name}: {score} pts, {solved_count} retos")
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"\n{updated} equipos actualizados."))
