from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.tasks import TaskPriority, TaskStatus


class TaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    next_action: str = Field(min_length=1, max_length=300)
    details: str | None = None
    owner: str | None = Field(default=None, max_length=120)
    status: TaskStatus = TaskStatus.OPEN
    priority: TaskPriority = TaskPriority.NORMAL
    due_date: date | None = None


class TaskUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    next_action: str | None = Field(default=None, min_length=1, max_length=300)
    details: str | None = None
    owner: str | None = Field(default=None, max_length=120)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "TaskUpdate":
        if not self.model_fields_set:
            raise ValueError("Provide at least one task field to update.")
        non_nullable_fields = {"title", "next_action", "status", "priority"}
        if any(
            getattr(self, field) is None
            for field in self.model_fields_set & non_nullable_fields
        ):
            raise ValueError("Title, next action, status, and priority cannot be null.")
        return self


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    next_action: str
    details: str | None
    owner: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    created_at: datetime
    updated_at: datetime
