import hashlib

import factory
from django.contrib.auth import get_user_model

from apps.challenges.models import Challenge

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"u{n}@test.com")
    password = factory.PostGenerationMethodCall("set_password", "testpass123!")


class ChallengeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Challenge

    slug = factory.Sequence(lambda n: f"challenge-{n}")
    name = factory.Sequence(lambda n: f"Challenge {n}")
    description = "Test challenge"
    points = 100
    image_name = "ctf-sqli:latest"
    flag_hash = factory.LazyAttribute(
        lambda _: hashlib.sha256(b"CTF{test_flag}").hexdigest()
    )
    internal_port = 5000
    hints = []
    is_active = True
