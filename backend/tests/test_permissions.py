from typing import Annotated
from uuid import UUID, uuid4

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.db import get_db
from app.deps import get_current_user, require_team_role
from app.models import Membership, TeamRole, User


class StubDatabase:
    def __init__(self, membership: Membership | None) -> None:
        self.membership = membership

    def get(self, model: type, identity: tuple[UUID, UUID]) -> Membership | None:
        assert model is Membership
        if self.membership is not None:
            assert identity == (self.membership.user_id, self.membership.team_id)
        return self.membership


@pytest.fixture
def user() -> User:
    return User(
        id=uuid4(),
        email="member@example.com",
        full_name="Team Member",
        password_hash="unused",
        is_active=True,
    )


def create_client(
    user: User,
    membership: Membership | None,
) -> TestClient:
    app = FastAPI()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: StubDatabase(membership)

    @app.get("/teams/{team_id}")
    def team_endpoint(
        membership: Annotated[
            Membership, Depends(require_team_role(TeamRole.MANAGER))
        ],
    ) -> dict[str, str]:
        return {"role": membership.role.value}

    return TestClient(app)


def test_missing_team_membership_returns_404(user: User) -> None:
    response = create_client(user, None).get(f"/teams/{uuid4()}")

    assert response.status_code == 404


def test_disallowed_team_role_returns_403(user: User) -> None:
    membership = Membership(user_id=user.id, team_id=uuid4(), role=TeamRole.MEMBER)

    response = create_client(user, membership).get(f"/teams/{membership.team_id}")

    assert response.status_code == 403


def test_allowed_team_role_is_returned(user: User) -> None:
    membership = Membership(user_id=user.id, team_id=uuid4(), role=TeamRole.MANAGER)

    response = create_client(user, membership).get(f"/teams/{membership.team_id}")

    assert response.status_code == 200
    assert response.json() == {"role": TeamRole.MANAGER.value}


def test_role_dependency_requires_at_least_one_role() -> None:
    with pytest.raises(ValueError, match="At least one allowed team role"):
        require_team_role()
