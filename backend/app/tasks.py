from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SqlEnum,
    Index,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TaskStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="ck_tasks_title_not_blank"),
        CheckConstraint(
            "length(trim(next_action)) > 0",
            name="ck_tasks_next_action_not_blank",
        ),
        Index("ix_tasks_status_created", "status", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[str] = mapped_column(String(300), nullable=False)
    owner: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[TaskStatus] = mapped_column(
        SqlEnum(
            TaskStatus,
            name="task_status",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
            length=20,
        ),
        nullable=False,
        default=TaskStatus.OPEN,
        server_default=TaskStatus.OPEN.value,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SqlEnum(
            TaskPriority,
            name="task_priority",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda members: [member.value for member in members],
            length=10,
        ),
        nullable=False,
        default=TaskPriority.NORMAL,
        server_default=TaskPriority.NORMAL.value,
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
