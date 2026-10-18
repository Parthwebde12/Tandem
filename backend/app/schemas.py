from datetime import datetime, timezone
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import (
    ItemEventType,
    TeamRole,
    WorkItemPriority,
    WorkItemState,
    WorkItemType,
)

T = TypeVar("T")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TeamMembershipRead(BaseModel):
    team_id: UUID
    team_name: str
    role: TeamRole


class MeResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    memberships: list[TeamMembershipRead]


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


class MemberRead(BaseModel):
    user_id: UUID
    full_name: str
    email: str
    role: TeamRole


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    team_id: UUID
    title: str
    description: str | None
    next_action: str
    type: WorkItemType
    state: WorkItemState
    priority: WorkItemPriority
    owner: UserBrief | None
    creator: UserBrief
    requires_approval: bool
    version: int
    due_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20000)
    next_action: str = Field(default="Needs triage", min_length=1, max_length=300)
    type: WorkItemType
    priority: WorkItemPriority = WorkItemPriority.MEDIUM
    requires_approval: bool = False
    due_at: datetime | None = None

    _due_aware = field_validator("due_at")(_aware)


class ItemUpdate(BaseModel):
    """Only fields that are sent are changed (see model_fields_set)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20000)
    next_action: str | None = Field(default=None, min_length=1, max_length=300)
    priority: WorkItemPriority | None = None
    requires_approval: bool | None = None
    due_at: datetime | None = None

    _due_aware = field_validator("due_at")(_aware)


class VersionedRequest(BaseModel):
    version: int = Field(ge=1)


class AssignRequest(BaseModel):
    version: int = Field(ge=1)
    assignee_id: UUID


class TransitionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    version: int = Field(ge=1)
    to_state: WorkItemState
    comment: str | None = Field(default=None, max_length=5000)


class CommentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=5000)


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    author: UserBrief
    body: str
    created_at: datetime


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor: UserBrief
    event_type: ItemEventType
    old_value: dict | None
    new_value: dict | None
    created_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    message: str
    work_item_id: UUID
    created_at: datetime
    read_at: datetime | None


class DashboardBucket(BaseModel):
    total: int
    items: list[ItemRead]


class DashboardRead(BaseModel):
    counts_by_state: dict[str, int]
    overdue_mine: DashboardBucket
    urgent_mine: DashboardBucket
    awaiting_my_approval: DashboardBucket
    unclaimed_urgent: DashboardBucket