from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TeamRole(str, Enum):
    VIEWER = "viewer"
    MEMBER = "member"
    MANAGER = "manager"
    ADMIN = "admin"


class WorkItemType(str, Enum):
    INCIDENT = "incident"
    CUSTOMER_ISSUE = "customer_issue"
    PAYMENT = "payment"
    COMPLIANCE = "compliance"
    TASK = "task"


class WorkItemState(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING_APPROVAL = "pending_approval"
    RESOLVED = "resolved"
    CLOSED = "closed"


class WorkItemPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ItemEventType(str, Enum):
    CREATED = "created"
    CLAIMED = "claimed"
    RELEASED = "released"
    ASSIGNED = "assigned"
    PRIORITY_CHANGED = "priority_changed"
    STATE_CHANGED = "state_changed"
    EDITED = "edited"
    COMMENTED = "commented"
    APPROVAL_REQUIREMENT_CHANGED = "approval_requirement_changed"


def enum_column(enum_class: type[Enum], name: str, length: int) -> SqlEnum:
    return SqlEnum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
        length=length,
    )


class IdMixin:
    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4
    )


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class User(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )

    memberships: Mapped[list[Membership]] = relationship(back_populates="user")
    created_items: Mapped[list[WorkItem]] = relationship(
        back_populates="creator", foreign_keys="WorkItem.created_by_id"
    )
    owned_items: Mapped[list[WorkItem]] = relationship(
        back_populates="owner", foreign_keys="WorkItem.owner_id"
    )
    item_events: Mapped[list[ItemEvent]] = relationship(back_populates="actor")
    comments: Mapped[list[Comment]] = relationship(back_populates="author")


class Team(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)

    memberships: Mapped[list[Membership]] = relationship(back_populates="team")
    work_items: Mapped[list[WorkItem]] = relationship(back_populates="team")


class Membership(Base):
    __tablename__ = "memberships"

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    team_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("teams.id", ondelete="RESTRICT"), primary_key=True
    )
    role: Mapped[TeamRole] = mapped_column(
        enum_column(TeamRole, "team_role", 7), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="memberships")
    team: Mapped[Team] = relationship(back_populates="memberships")


class WorkItem(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "work_items"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_work_items_version_positive"),
        CheckConstraint(                                        # NEW
            "length(trim(next_action)) > 0",                    # NEW
            name="ck_work_items_next_action_not_blank",         # NEW
        ),                                                      # NEW
        CheckConstraint(
            "(state = 'open' AND owner_id IS NULL) OR "
            "(state != 'open' AND owner_id IS NOT NULL)",
            name="ck_work_items_state_owner_consistent",
        ),
        Index("ix_work_items_team_created", "team_id", "created_at", "id"),
        Index("ix_work_items_team_state", "team_id", "state"),
        Index(
            "ix_work_items_team_unclaimed_urgent",
            "team_id",
            "created_at",
            "id",
            postgresql_where=text(
                "owner_id IS NULL AND priority = 'urgent' AND state = 'open'"
            ),
        ),
        Index(
            "ix_work_items_owner_urgent",
            "owner_id",
            "team_id",
            "created_at",
            "id",
            postgresql_where=text(
                "owner_id IS NOT NULL AND priority = 'urgent'"
            ),
        ),
        Index(
            "ix_work_items_owner_due",
            "owner_id",
            "due_at",
            "id",
            postgresql_where=text(
                "owner_id IS NOT NULL AND due_at IS NOT NULL "
                "AND state IN ('in_progress', 'pending_approval')"
            ),
        ),
        Index(
            "ix_work_items_search",
            text(
                "to_tsvector('english', "
                "coalesce(title, '') || ' ' || coalesce(description, ''))"
            ),
            postgresql_using="gin",
        ),
    )

    team_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        default="Needs triage",
        server_default="Needs triage",
    )
    type: Mapped[WorkItemType] = mapped_column(
        enum_column(WorkItemType, "work_item_type", 20), nullable=False
    )
    state: Mapped[WorkItemState] = mapped_column(
        enum_column(WorkItemState, "work_item_state", 20),
        nullable=False,
        default=WorkItemState.OPEN,
        server_default=WorkItemState.OPEN.value,
    )
    priority: Mapped[WorkItemPriority] = mapped_column(
        enum_column(WorkItemPriority, "work_item_priority", 10),
        nullable=False,
        default=WorkItemPriority.MEDIUM,
        server_default=WorkItemPriority.MEDIUM.value,
    )
    owner_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_by_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    team: Mapped[Team] = relationship(back_populates="work_items")
    creator: Mapped[User] = relationship(
        back_populates="created_items", foreign_keys=[created_by_id]
    )
    owner: Mapped[User | None] = relationship(
        back_populates="owned_items", foreign_keys=[owner_id]
    )
    events: Mapped[list[ItemEvent]] = relationship(back_populates="work_item")
    comments: Mapped[list[Comment]] = relationship(back_populates="work_item")


class ItemEvent(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "item_events"
    __table_args__ = (Index("ix_item_events_item_created", "work_item_id", "created_at"),)

    work_item_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("work_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    actor_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    event_type: Mapped[ItemEventType] = mapped_column(
        enum_column(ItemEventType, "item_event_type", 32), nullable=False
    )
    old_value: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    new_value: Mapped[dict[str, object] | None] = mapped_column(JSONB)

    work_item: Mapped[WorkItem] = relationship(back_populates="events")
    actor: Mapped[User] = relationship(back_populates="item_events")


class Comment(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_item_created", "work_item_id", "created_at"),)

    work_item_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("work_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    author_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    work_item: Mapped[WorkItem] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(back_populates="comments")


class OutboxEvent(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index("ix_outbox_events_pending", "processed_at", "available_at"),
    )

    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregate_type: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregate_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    last_error: Mapped[str | None] = mapped_column(Text)

class IdempotencyKey(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_idempotency_user_key"),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # NULL while the first request is still in progress
    response_status: Mapped[int | None] = mapped_column(Integer)
    response_body: Mapped[dict[str, object] | None] = mapped_column(JSONB)