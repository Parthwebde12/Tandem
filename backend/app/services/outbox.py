"""Outbox processing: turns outbox events into notifications.

At-least-once delivery: an event may be handled more than once, but the
unique (outbox_event_id, user_id) key makes the side effect happen once.
"""

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Membership, Notification, OutboxEvent, TeamRole
from app.services.work_items import now_utc

log = logging.getLogger("opsdesk.outbox")
MAX_ATTEMPTS = 5
PAST_TENSE = {
    "approve": "approved",
    "resolve": "resolved",
    "close": "closed",
    "reopen": "reopened",
}


def _uuid(value) -> UUID | None:
    return UUID(value) if value else None


def recipients(db: Session, event: OutboxEvent) -> list[tuple[UUID, str, str]]:
    p = event.payload
    title = p.get("title", "an item")
    actor = _uuid(p.get("actor_id"))
    owner = _uuid(p.get("owner_id"))
    creator = _uuid(p.get("creator_id"))
    team_id = _uuid(p.get("team_id"))
    out: list[tuple[UUID, str, str]] = []

    def managers() -> list[UUID]:
        return list(
            db.scalars(
                select(Membership.user_id).where(
                    Membership.team_id == team_id,
                    Membership.role.in_([TeamRole.MANAGER, TeamRole.ADMIN]),
                )
            )
        )

    kind = event.event_type
    if kind == "item.urgent_unclaimed":
        out += [(u, kind, f'Urgent item has no owner: "{title}"') for u in managers()]
    elif kind == "item.assigned":
        assignee = _uuid(p.get("assignee_id"))
        if assignee:
            out.append((assignee, kind, f'You were assigned: "{title}"'))
    elif kind == "item.claimed":
        if creator:
            out.append((creator, kind, f'Your item was claimed: "{title}"'))
    elif kind == "item.commented":
        out += [(u, kind, f'New comment on "{title}"') for u in (owner, creator) if u]
    elif kind == "item.state_changed":
        action = p.get("action")
        if action == "submit_for_approval":
            out += [
                (u, kind, f'Approval needed: "{title}"') for u in managers() if u != owner
            ]
        elif action == "reject" and owner:
            out.append((owner, kind, f'Approval rejected: "{title}"'))
        elif action in PAST_TENSE:
            out += [
                (u, kind, f'Item {PAST_TENSE[action]}: "{title}"')
                for u in (owner, creator)
                if u
            ]
    return [(u, k, m) for u, k, m in out if u != actor]


def handle_event(db: Session, event: OutboxEvent) -> None:
    seen: set[UUID] = set()
    for user_id, kind, message in recipients(db, event):
        if user_id in seen:
            continue
        seen.add(user_id)
        db.execute(
            pg_insert(Notification)
            .values(
                user_id=user_id,
                outbox_event_id=event.id,
                work_item_id=event.aggregate_id,
                kind=kind,
                message=message[:500],
            )
            .on_conflict_do_nothing(constraint="uq_notifications_event_user")
        )


def process_pending(session_factory=SessionLocal, limit: int = 50) -> int:
    """Handle up to `limit` due events. Returns how many succeeded."""
    done = 0
    for _ in range(limit):
        with session_factory() as db:
            event = db.scalars(
                select(OutboxEvent)
                .where(
                    OutboxEvent.processed_at.is_(None),
                    OutboxEvent.attempts < MAX_ATTEMPTS,
                    OutboxEvent.available_at <= func.now(),
                )
                .order_by(OutboxEvent.created_at, OutboxEvent.id)
                .limit(1)
                .with_for_update(skip_locked=True)
            ).first()
            if event is None:
                return done
            event_id = event.id
            try:
                handle_event(db, event)
                event.processed_at = func.now()
                db.commit()
                done += 1
            except Exception as exc:
                db.rollback()
                attempts = (
                    db.scalar(
                        select(OutboxEvent.attempts).where(OutboxEvent.id == event_id)
                    )
                    or 0
                )
                delay = min(5 * 2**attempts, 300)
                db.execute(
                    update(OutboxEvent)
                    .where(OutboxEvent.id == event_id)
                    .values(
                        attempts=OutboxEvent.attempts + 1,
                        last_error=str(exc)[:1000],
                        available_at=now_utc() + timedelta(seconds=delay),
                    )
                )
                db.commit()
                log.warning("outbox event %s failed: %s", event_id, exc)
    return done