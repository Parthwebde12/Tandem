from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.task_schemas import TaskCreate, TaskRead, TaskUpdate
from app.tasks import Task, TaskStatus

router = APIRouter(prefix="/tasks", tags=["tasks"])
DatabaseSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[TaskRead])
def list_tasks(
    db: DatabaseSession,
    task_status: Annotated[TaskStatus | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[Task]:
    statement = select(Task)
    if task_status is not None:
        statement = statement.where(Task.status == task_status)
    if search:
        pattern = f"%{search}%"
        statement = statement.where(
            Task.title.ilike(pattern)
            | Task.details.ilike(pattern)
            | Task.next_action.ilike(pattern)
        )
    statement = statement.order_by(Task.created_at.desc(), Task.id.desc()).limit(limit)
    return list(db.scalars(statement).all())


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: DatabaseSession) -> Task:
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: UUID, payload: TaskUpdate, db: DatabaseSession) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, db: DatabaseSession) -> Response:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
