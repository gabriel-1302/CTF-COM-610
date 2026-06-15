"""
Shared pytest fixtures for all apps.
"""
import hashlib

import pytest
from rest_framework.test import APIClient

from apps.tests.factories import ChallengeFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def challenge(db):
    return ChallengeFactory(
        slug="sqli",
        flag_hash=hashlib.sha256(b"CTF{test_flag}").hexdigest(),
        points=100,
        image_name="ctf-sqli:latest",
        internal_port=5000,
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client
