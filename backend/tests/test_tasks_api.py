from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.tasks import Task


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[Task.__table__])
    test_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db() -> Iterator[Session]:
        with test_session() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_task_crud_and_filters(client: TestClient) -> None:
    created = client.post(
        "/tasks",
        json={
            "title": "  Ship release  ",
            "next_action": "  Ask QA for approval  ",
            "details": "Wait for smoke tests",
            "owner": "Alex",
            "priority": "high",
            "due_date": date(2026, 10, 20).isoformat(),
        },
    )

    assert created.status_code == 201
    task = created.json()
    assert task["title"] == "Ship release"
    assert task["next_action"] == "Ask QA for approval"
    assert task["status"] == "open"

    updated = client.patch(f"/tasks/{task['id']}", json={"status": "in_progress"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "in_progress"

    assert len(client.get("/tasks?status=in_progress&search=QA").json()) == 1
    assert client.get("/tasks?status=done").json() == []
    assert client.delete(f"/tasks/{task['id']}").status_code == 204
    assert client.get("/tasks").json() == []


def test_task_validation_and_unknown_ids(client: TestClient) -> None:
    assert client.post(
        "/tasks", json={"title": "   ", "next_action": "Do the thing"}
    ).status_code == 422
    assert client.post(
        "/tasks", json={"title": "Task", "next_action": "   "}
    ).status_code == 422
    assert client.patch(
        "/tasks/00000000-0000-0000-0000-000000000001", json={}
    ).status_code == 422
    assert client.patch(
        "/tasks/00000000-0000-0000-0000-000000000001", json={"title": None}
    ).status_code == 422
    assert client.patch(
        "/tasks/00000000-0000-0000-0000-000000000001", json={"status": "waiting"}
    ).status_code == 422
    assert client.patch(
        "/tasks/00000000-0000-0000-0000-000000000001", json={"status": "done"}
    ).status_code == 404
    assert client.delete("/tasks/00000000-0000-0000-0000-000000000001").status_code == 404


def test_task_list_limit_is_bounded(client: TestClient) -> None:
    assert client.get("/tasks?limit=101").status_code == 422
