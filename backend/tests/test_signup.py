"""Demo sign-up: people pick their own name, email, team and role."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from tests.helpers import make_team

pytestmark = pytest.mark.usefixtures("db_clean")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def open_signup(monkeypatch):
    monkeypatch.setattr(settings, "open_signup", True)


def payload(team_id, **overrides):
    return {
        "full_name": "Priya Sharma",
        "email": "Priya@Example.com",
        "password": "a-strong-pass",
        "team_id": str(team_id),
        "role": "manager",
        **overrides,
    }


def test_signup_is_closed_by_default(client):
    team = make_team()
    assert client.get("/auth/signup-options").json() == {
        "enabled": False, "teams": [], "roles": []
    }
    assert client.post("/auth/register", json=payload(team)).status_code == 403


def test_signup_creates_account_with_chosen_name_and_role(client, open_signup):
    team = make_team("Support")
    options = client.get("/auth/signup-options").json()
    assert options["enabled"] and options["teams"][0]["name"] == "Support"

    r = client.post("/auth/register", json=payload(team))
    assert r.status_code == 201
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).json()
    assert me["full_name"] == "Priya Sharma"
    assert me["email"] == "priya@example.com"  # stored lowercase
    assert me["memberships"][0]["role"] == "manager"

    # and the new account can sign in with the password it chose
    login = client.post("/auth/login", json={"email": "PRIYA@example.com", "password": "a-strong-pass"})
    assert login.status_code == 200


def test_duplicate_email_is_rejected(client, open_signup):
    team = make_team()
    assert client.post("/auth/register", json=payload(team)).status_code == 201
    again = client.post("/auth/register", json=payload(team, full_name="Someone Else"))
    assert again.status_code == 409


def test_weak_input_is_rejected(client, open_signup):
    team = make_team()
    assert client.post("/auth/register", json=payload(team, password="short")).status_code == 422
    assert client.post("/auth/register", json=payload(team, email="not-an-email")).status_code == 422
    assert client.post("/auth/register", json=payload(team, role="superuser")).status_code == 422
    assert client.post("/auth/register", json=payload(team, password="x" * 80)).status_code == 422
    unknown_team = "00000000-0000-0000-0000-000000000001"
    assert client.post("/auth/register", json=payload(unknown_team)).status_code == 422