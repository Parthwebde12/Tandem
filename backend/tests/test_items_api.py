"""Behaviours that would be dangerous if wrong (see docs/INVARIANTS.md)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

from app.db import SessionLocal
from app.main import app
from app.models import (
    ItemEvent,
    ItemEventType,
    Notification,
    OutboxEvent,
    TeamRole,
    WorkItem,
    WorkItemPriority,
    WorkItemState,
)
from app.services import outbox
from tests.helpers import make_item, make_team, make_user

pytestmark = pytest.mark.usefixtures("db_clean")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def world():
    team = make_team("Support")
    other_team = make_team("Engineering")
    users = {
        "admin": make_user(team, TeamRole.ADMIN, "Ada Admin"),
        "manager": make_user(team, TeamRole.MANAGER, "Max Manager"),
        "member": make_user(team, TeamRole.MEMBER, "Mia Member"),
        "member2": make_user(team, TeamRole.MEMBER, "Mo Member"),
        "viewer": make_user(team, TeamRole.VIEWER, "Vic Viewer"),
        "outsider": make_user(other_team, TeamRole.MEMBER, "Otto Outsider"),
    }
    return {"team": team, "other_team": other_team, **users}


def count(model) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_ten_concurrent_claims_exactly_one_wins(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    claimers = [
        make_user(world["team"], TeamRole.MEMBER, f"Racer {i}") for i in range(10)
    ]
    barrier = Barrier(len(claimers))

    def claim(user):
        barrier.wait()
        return TestClient(app).post(f"/items/{item_id}/claim", headers=user["headers"])

    with ThreadPoolExecutor(max_workers=10) as pool:
        responses = list(pool.map(claim, claimers))

    codes = sorted(r.status_code for r in responses)
    assert codes == [200] + [409] * 9

    winner_id = next(r.json()["owner"]["id"] for r in responses if r.status_code == 200)
    with SessionLocal() as db:
        item = db.get(WorkItem, item_id)
        assert str(item.owner_id) == winner_id
        assert item.state == WorkItemState.IN_PROGRESS
        claimed_events = db.scalar(
            select(func.count())
            .select_from(ItemEvent)
            .where(
                ItemEvent.work_item_id == item_id,
                ItemEvent.event_type == ItemEventType.CLAIMED,
            )
        )
        assert claimed_events == 1


def test_losing_claim_returns_current_item(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    client.post(f"/items/{item_id}/claim", headers=world["member"]["headers"])
    lost = client.post(f"/items/{item_id}/claim", headers=world["member2"]["headers"])
    assert lost.status_code == 409
    assert lost.json()["detail"]["current_item"]["owner"]["full_name"] == "Mia Member"


def test_stale_edit_is_rejected_and_never_overwrites(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    h = world["manager"]["headers"]
    first = client.patch(f"/items/{item_id}", json={"version": 1, "title": "A"}, headers=h)
    assert first.status_code == 200 and first.json()["version"] == 2

    stale = client.patch(f"/items/{item_id}", json={"version": 1, "title": "B"}, headers=h)
    assert stale.status_code == 409
    assert stale.json()["detail"]["current_item"]["title"] == "A"
    with SessionLocal() as db:
        assert db.get(WorkItem, item_id).title == "A"


def test_concurrent_edits_same_version_only_one_applies(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    h = world["manager"]["headers"]
    barrier = Barrier(2)

    def edit(title):
        barrier.wait()
        return TestClient(app).patch(
            f"/items/{item_id}", json={"version": 1, "title": title}, headers=h
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(edit, ["one", "two"]))
    assert sorted(r.status_code for r in results) == [200, 409]


def test_same_idempotency_key_creates_one_item(client, world):
    body = {"title": "Payment stuck", "type": "payment"}
    h = {**world["member"]["headers"], "Idempotency-Key": "abc-123"}
    url = f"/teams/{world['team']}/items"
    first = client.post(url, json=body, headers=h)
    second = client.post(url, json=body, headers=h)

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert second.headers["Idempotent-Replay"] == "true"
    assert count(WorkItem) == 1
    assert count(OutboxEvent) >= 1


def test_idempotency_key_reused_with_different_body_is_rejected(client, world):
    h = {**world["member"]["headers"], "Idempotency-Key": "k1"}
    url = f"/teams/{world['team']}/items"
    client.post(url, json={"title": "A", "type": "task"}, headers=h)
    other = client.post(url, json={"title": "B", "type": "task"}, headers=h)
    assert other.status_code == 422
    assert count(WorkItem) == 1


def test_concurrent_requests_with_same_key_create_one_item(client, world):
    h = {**world["member"]["headers"], "Idempotency-Key": "race-key"}
    url = f"/teams/{world['team']}/items"
    barrier = Barrier(5)

    def create(_):
        barrier.wait()
        return TestClient(app).post(url, json={"title": "Once", "type": "task"}, headers=h)

    with ThreadPoolExecutor(max_workers=5) as pool:
        responses = list(pool.map(create, range(5)))
    assert {r.status_code for r in responses} == {201}
    assert len({r.json()["id"] for r in responses}) == 1
    assert count(WorkItem) == 1


def test_non_member_gets_404_everywhere(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    h = world["outsider"]["headers"]
    assert client.get(f"/items/{item_id}", headers=h).status_code == 404
    assert client.post(f"/items/{item_id}/claim", headers=h).status_code == 404
    assert client.get(f"/items/{item_id}/events", headers=h).status_code == 404
    assert client.get(f"/teams/{world['team']}/members", headers=h).status_code == 404
    listed = client.get("/items", headers=h).json()
    assert listed["items"] == []


def test_roles_limit_actions(client, world):
    url = f"/teams/{world['team']}/items"
    body = {"title": "x", "type": "task"}
    assert client.post(url, json=body, headers=world["viewer"]["headers"]).status_code == 403
    item_id = make_item(world["team"], world["manager"]["id"])
    assert client.post(f"/items/{item_id}/claim", headers=world["viewer"]["headers"]).status_code == 403
    assign = {"version": 1, "assignee_id": str(world["member"]["id"])}
    assert client.post(f"/items/{item_id}/assign", json=assign, headers=world["member"]["headers"]).status_code == 403
    assert client.post(f"/items/{item_id}/assign", json=assign, headers=world["manager"]["headers"]).status_code == 200


def test_member_cannot_edit_someone_elses_item(client, world):
    item_id = make_item(
        world["team"], world["manager"]["id"],
        state=WorkItemState.IN_PROGRESS, owner_id=world["member"]["id"],
    )
    r = client.patch(f"/items/{item_id}", json={"version": 1, "title": "hax"}, headers=world["member2"]["headers"])
    assert r.status_code == 403


def transition(client, item_id, who, to, version, comment=None):
    return client.post(
        f"/items/{item_id}/transition",
        json={"version": version, "to_state": to, "comment": comment},
        headers=who["headers"],
    )


def test_invalid_transition_is_422(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    r = transition(client, item_id, world["manager"], "closed", 1)
    assert r.status_code == 422


def test_approval_flow_and_separation_of_duties(client, world):
    item_id = make_item(
        world["team"], world["member"]["id"],
        state=WorkItemState.IN_PROGRESS, owner_id=world["member"]["id"],
        requires_approval=True,
    )
    assert transition(client, item_id, world["member"], "resolved", 1).status_code == 422
    assert transition(client, item_id, world["member2"], "pending_approval", 1).status_code == 403
    assert transition(client, item_id, world["member"], "pending_approval", 1).status_code == 200
    assert transition(client, item_id, world["member"], "resolved", 2).status_code == 403
    assert transition(client, item_id, world["manager"], "in_progress", 2).status_code == 422
    ok = transition(client, item_id, world["manager"], "in_progress", 2, "Missing proof")
    assert ok.status_code == 200 and ok.json()["state"] == "in_progress"
    comments = client.get(f"/items/{item_id}/comments", headers=world["member"]["headers"]).json()
    assert comments["items"][0]["body"] == "Missing proof"


def test_creator_manager_cannot_approve_own_item(client, world):
    item_id = make_item(
        world["team"], world["manager"]["id"],
        state=WorkItemState.PENDING_APPROVAL, owner_id=world["member"]["id"],
        requires_approval=True,
    )
    assert transition(client, item_id, world["manager"], "resolved", 1).status_code == 403
    assert transition(client, item_id, world["admin"], "resolved", 1).status_code == 200


def test_closed_is_terminal(client, world):
    item_id = make_item(
        world["team"], world["manager"]["id"],
        state=WorkItemState.CLOSED, owner_id=world["member"]["id"],
    )
    assert transition(client, item_id, world["admin"], "in_progress", 1, "again").status_code == 422
    r = client.patch(f"/items/{item_id}", json={"version": 1, "title": "x"}, headers=world["admin"]["headers"])
    assert r.status_code == 422


def test_every_change_writes_exactly_one_event_in_same_transaction(client, world):
    created = client.post(
        f"/teams/{world['team']}/items",
        json={"title": "Audit me", "type": "task"},
        headers=world["member"]["headers"],
    ).json()
    item_id = created["id"]
    client.post(f"/items/{item_id}/claim", headers=world["member"]["headers"])
    client.patch(f"/items/{item_id}", json={"version": 2, "priority": "high"}, headers=world["member"]["headers"])
    events = client.get(f"/items/{item_id}/events", headers=world["viewer"]["headers"]).json()["items"]
    assert [e["event_type"] for e in events] == ["priority_changed", "claimed", "created"]


def test_audit_events_cannot_be_updated_or_deleted(client, world):
    item_id = make_item(world["team"], world["manager"]["id"])
    client.post(f"/items/{item_id}/claim", headers=world["member"]["headers"])
    with SessionLocal() as db:
        with pytest.raises(Exception, match="append-only"):
            db.execute(text("UPDATE item_events SET event_type = 'edited'"))
            db.commit()
    with SessionLocal() as db:
        with pytest.raises(Exception, match="append-only"):
            db.execute(text("DELETE FROM item_events"))
            db.commit()


def test_keyset_pagination_returns_every_item_once(client, world):
    for i in range(60):
        make_item(world["team"], world["manager"]["id"], title=f"Item {i}")
    seen, cursor = [], None
    while True:
        params = {"limit": 25, **({"cursor": cursor} if cursor else {})}
        page = client.get("/items", params=params, headers=world["member"]["headers"]).json()
        assert len(page["items"]) <= 25
        seen += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(seen) == 60 and len(set(seen)) == 60


def test_limit_is_capped(client, world):
    r = client.get("/items", params={"limit": 1000}, headers=world["member"]["headers"])
    assert r.status_code == 422


def test_search_and_filters(client, world):
    make_item(world["team"], world["manager"]["id"], title="Refund for enterprise client")
    make_item(world["team"], world["manager"]["id"], title="Database CPU spike",
              priority=WorkItemPriority.URGENT)
    h = world["member"]["headers"]
    found = client.get("/items", params={"q": "refund"}, headers=h).json()["items"]
    assert [i["title"] for i in found] == ["Refund for enterprise client"]
    urgent = client.get("/items", params={"priority": "urgent", "unassigned": "true"}, headers=h).json()["items"]
    assert [i["title"] for i in urgent] == ["Database CPU spike"]


def test_dashboard_buckets(client, world):
    make_item(world["team"], world["manager"]["id"], title="Urgent open",
              priority=WorkItemPriority.URGENT)
    make_item(world["team"], world["member"]["id"], title="Needs approval",
              state=WorkItemState.PENDING_APPROVAL, owner_id=world["member"]["id"],
              requires_approval=True)
    data = client.get("/dashboard", headers=world["manager"]["headers"]).json()
    assert data["unclaimed_urgent"]["total"] == 1
    assert data["awaiting_my_approval"]["total"] == 1
    assert data["counts_by_state"]["open"] == 1
    member_view = client.get("/dashboard", headers=world["member"]["headers"]).json()
    assert member_view["awaiting_my_approval"]["total"] == 0


def test_outbox_is_written_with_the_change_and_processed_once(client, world):
    client.post(
        f"/teams/{world['team']}/items",
        json={"title": "Site down", "type": "incident", "priority": "urgent"},
        headers=world["member"]["headers"],
    )
    assert count(OutboxEvent) == 2

    assert outbox.process_pending() == 2
    first = count(Notification)
    assert first == 2

    with SessionLocal() as db:
        event = db.scalars(select(OutboxEvent).where(OutboxEvent.event_type == "item.urgent_unclaimed")).one()
        outbox.handle_event(db, event)
        db.commit()
    assert count(Notification) == first
    assert outbox.process_pending() == 0


def test_failed_outbox_event_is_retried_later_not_lost(client, world, monkeypatch):
    client.post(
        f"/teams/{world['team']}/items",
        json={"title": "Flaky", "type": "task"},
        headers=world["member"]["headers"],
    )

    def boom(db, event):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(outbox, "handle_event", boom)
    assert outbox.process_pending() == 0
    with SessionLocal() as db:
        event = db.scalars(select(OutboxEvent)).one()
        assert event.processed_at is None
        assert event.attempts == 1
        assert "smtp down" in event.last_error
        assert event.available_at > datetime.now(timezone.utc)
    monkeypatch.undo()
    assert outbox.process_pending() == 0