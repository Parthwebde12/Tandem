from uuid import UUID

from app.core.security import create_access_token
from app.db import SessionLocal
from app.models import (
    Membership,
    Team,
    TeamRole,
    User,
    WorkItem,
    WorkItemPriority,
    WorkItemState,
    WorkItemType,
)


def make_team(name: str = "Support") -> UUID:
    with SessionLocal() as db:
        team = Team(name=name)
        db.add(team)
        db.commit()
        return team.id


def make_user(team_id: UUID | None, role: TeamRole | None, name: str) -> dict:
    with SessionLocal() as db:
        user = User(
            email=f"{name.lower().replace(' ', '.')}@test.dev",
            full_name=name,
            password_hash="unused",
        )
        db.add(user)
        db.flush()
        if team_id is not None and role is not None:
            db.add(Membership(user_id=user.id, team_id=team_id, role=role))
        db.commit()
        return {
            "id": user.id,
            "headers": {"Authorization": f"Bearer {create_access_token(user.id)}"},
        }


def make_item(
    team_id: UUID,
    creator_id: UUID,
    *,
    title: str = "Something broke",
    state: WorkItemState = WorkItemState.OPEN,
    owner_id: UUID | None = None,
    priority: WorkItemPriority = WorkItemPriority.MEDIUM,
    requires_approval: bool = False,
) -> UUID:
    with SessionLocal() as db:
        item = WorkItem(
            team_id=team_id,
            title=title,
            type=WorkItemType.TASK,
            state=state,
            owner_id=owner_id,
            priority=priority,
            created_by_id=creator_id,
            requires_approval=requires_approval,
        )
        db.add(item)
        db.commit()
        return item.id