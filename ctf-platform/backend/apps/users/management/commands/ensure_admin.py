import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Crea el usuario admin si no existe (idempotente)."

    def handle(self, *args, **options):
        username = os.environ.get("ADMIN_USERNAME", "admin")
        password = os.environ.get("ADMIN_PASSWORD", "admin")
        email    = os.environ.get("ADMIN_EMAIL", "admin@ctf.local")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f"[ensure_admin] Admin '{username}' creado."
            ))
        else:
            # Garantiza permisos aunque el usuario ya existiera sin ellos
            if not user.is_staff or not user.is_superuser:
                user.is_staff = True
                user.is_superuser = True
                user.save()
                self.stdout.write(self.style.WARNING(
                    f"[ensure_admin] '{username}' ya existía — permisos de admin aplicados."
                ))
            else:
                self.stdout.write(
                    f"[ensure_admin] Admin '{username}' ya existe, sin cambios."
                )
