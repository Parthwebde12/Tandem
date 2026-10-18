"""Work-item business rules.

Every function here only flushes; the caller (router + idempotency helper)
commits, so state change + audit event + outbox event are ONE transaction.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.models import (
    Comment,
    ItemEvent,
    ItemEventType,
    Membership,
    OutboxEvent,
    TeamRole,
    User,
    WorkItem,
    WorkItemPriority,
    WorkItemState,
)
from app.schemas import (
    ItemCreate,
    ItemRead,
    ItemUpdate,
    TransitionRequest,
)

ROLE_RANK = {
    TeamRole.VIEWER: 0,
    TeamRole.MEMBER: 1,
    TeamRole.MANAGER: 2,
    TeamRole.ADMIN: 3,
}


@dataclass
class ItemContext:
    item: WorkItem
    membership: Membership
    user: User


def has_role(membership: Membership, minimum: TeamRole) -> bool:
    return ROLE_RANK[membership.role] >= ROLE_RANK[minimum]


def require_role(membership: Membership, minimum: TeamRole, message: str) -> None:
    if not has_role(membership, minimum):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=message)


def unprocessable(message: str) -> HTTPException:
    return HTTPException(422, detail=message)


def conflict(db: Session, item: WorkItem, message: str) -> HTTPException:
    """409 that carries the current item so the client can reconcile."""
    db.refresh(item)
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail={
            "message": message,
            "current_item": jsonable_encoder(ItemRead.model_validate(item)),
        },
    )


def check_version(db: Session, item: WorkItem, expected: int) -> None:
    if item.version != expected:
        raise conflict(
            db, item, "This item was changed by someone else. Review and retry."
        )


def guarded_update(
    db: Session, item: WorkItem, values: dict[str, Any], *conditions: Any
) -> bool:
    """One atomic conditional UPDATE. True if it matched (and bumped version).

    Postgres row-locks the row, so a concurrent writer waits, re-checks the
    WHERE clause and matches 0 rows. That is how races are decided.
    """
    stmt = (
        update(WorkItem)
        .where(WorkItem.id == item.id, *conditions)
        .values(**values, version=WorkItem.version + 1, updated_at=func.now())
        .returning(WorkItem.id)
        .execution_options(synchronize_session=False)
    )
    if db.execute(stmt).first() is None:
        return False
    db.refresh(item)
    return True


def record(
    db: Session,
    item: WorkItem,
    actor: User,
    event_type: ItemEventType,
    old: dict | None,
    new: dict | None,
    outbox: list[tuple[str, dict]] | None = None,
) -> None:
    db.add(
        ItemEvent(
            work_item_id=item.id,
            actor_id=actor.id,
            event_type=event_type,
            old_value=jsonable_encoder(old),
            new_value=jsonable_encoder(new),
        )
    )
    for outbox_type, extra in outbox or []:
        payload = {
            "item_id": item.id,
            "team_id": item.team_id,
            "title": item.title,
            "actor_id": actor.id,
            "owner_id": item.owner_id,
            "creator_id": item.created_by_id,
            **extra,
        }
        db.add(
            OutboxEvent(
                event_type=outbox_type,
                aggregate_type="work_item",
                aggregate_id=item.id,
                payload=jsonable_encoder(payload),
            )
        )
    db.flush()


def _urgent_unclaimed(item: WorkItem) -> list[tuple[str, dict]]:
    if item.priority == WorkItemPriority.URGENT and item.owner_id is None:
        return [("item.urgent_unclaimed", {})]
    return []


def create_item(
    db: Session, actor: User, membership: Membership, team_id: UUID, data: ItemCreate
) -> WorkItem:
    require_role(membership, TeamRole.MEMBER, "Your role cannot create items.")
    item = WorkItem(
        team_id=team_id,
        title=data.title,
        description=data.description,
        next_action=data.next_action,
        type=data.type,
        priority=data.priority,
        requires_approval=data.requires_approval,
        due_at=data.due_at,
        created_by_id=actor.id,
        state=WorkItemState.OPEN,
    )
    db.add(item)
    db.flush()
    db.refresh(item)
    record(
        db,
        item,
        actor,
        ItemEventType.CREATED,
        None,
        {"title": item.title, "priority": item.priority, "type": item.type},
        [("item.created", {})] + _urgent_unclaimed(item),
    )
    return item


def claim(db: Session, ctx: ItemContext) -> WorkItem:
    item, actor = ctx.item, ctx.user
    require_role(ctx.membership, TeamRole.MEMBER, "Your role cannot claim items.")
    ok = guarded_update(
        db,
        item,
        {"state": WorkItemState.IN_PROGRESS, "owner_id": actor.id},
        WorkItem.state == WorkItemState.OPEN,
        WorkItem.owner_id.is_(None),
    )
    if not ok:
        raise conflict(db, item, "This item was already claimed or is not open.")
    record(
        db,
        item,
        actor,
        ItemEventType.CLAIMED,
        {"state": WorkItemState.OPEN, "owner_id": None},
        {"state": WorkItemState.IN_PROGRESS, "owner_id": actor.id},
        [("item.claimed", {})],
    )
    return item


def release(db: Session, ctx: ItemContext, version: int) -> WorkItem:
    item, actor = ctx.item, ctx.user
    check_version(db, item, version)
    if not (item.owner_id == actor.id or has_role(ctx.membership, TeamRole.MANAGER)):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only the owner or a manager can release this item.",
        )
    if item.state != WorkItemState.IN_PROGRESS:
        raise unprocessable("Only in-progress items can be released.")
    old = {"state": item.state, "owner_id": item.owner_id}
    ok = guarded_update(
        db,
        item,
        {"state": WorkItemState.OPEN, "owner_id": None},
        WorkItem.version == version,
        WorkItem.state == WorkItemState.IN_PROGRESS,
    )
    if not ok:
        raise conflict(db, item, "This item was changed by someone else.")
    record(
        db,
        item,
        actor,
        ItemEventType.RELEASED,
        old,
        {"state": WorkItemState.OPEN, "owner_id": None},
        _urgent_unclaimed(item),
    )
    return item


def assign(db: Session, ctx: ItemContext, version: int, assignee_id: UUID) -> WorkItem:
    item, actor = ctx.item, ctx.user
    require_role(ctx.membership, TeamRole.MANAGER, "Only managers can assign items.")
    check_version(db, item, version)
    if item.state not in (WorkItemState.OPEN, WorkItemState.IN_PROGRESS):
        raise unprocessable("Only open or in-progress items can be assigned.")
    target = db.get(Membership, (assignee_id, item.team_id))
    if target is None or not has_role(target, TeamRole.MEMBER):
        raise unprocessable("Assignee must be a member of this team (not a viewer).")
    if item.owner_id == assignee_id:
        raise unprocessable("This user already owns the item.")
    old = {"state": item.state, "owner_id": item.owner_id}
    ok = guarded_update(
        db,
        item,
        {"state": WorkItemState.IN_PROGRESS, "owner_id": assignee_id},
        WorkItem.version == version,
    )
    if not ok:
        raise conflict(db, item, "This item was changed by someone else.")
    record(
        db,
        item,
        actor,
        ItemEventType.ASSIGNED,
        old,
        {"state": WorkItemState.IN_PROGRESS, "owner_id": assignee_id},
        [("item.assigned", {"assignee_id": assignee_id})],
    )
    return item


EDIT_FIELDS = ("title", "description", "next_action", "due_at")


def update_fields(db: Session, ctx: ItemContext, data: ItemUpdate) -> WorkItem:
    item, actor = ctx.item, ctx.user
    sent = {f: getattr(data, f) for f in data.model_fields_set if f != "version"}
    if not sent:
        raise unprocessable("No fields to update.")
    if item.state == WorkItemState.CLOSED:
        raise unprocessable("Closed items cannot be edited.")
    check_version(db, item, data.version)

    for field in ("title", "next_action", "priority", "requires_approval"):
        if field in sent and sent[field] is None:
            raise unprocessable(f"{field} cannot be empty.")

    is_manager = has_role(ctx.membership, TeamRole.MANAGER)
    if not (item.owner_id == actor.id or is_manager):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Only the owner or a manager can edit this item.",
        )
    if "requires_approval" in sent:
        require_role(
            ctx.membership, TeamRole.MANAGER, "Only managers can change approval rules."
        )
        if item.state not in (WorkItemState.OPEN, WorkItemState.IN_PROGRESS):
            raise unprocessable(
                "Approval rules can only change while the item is open or in progress."
            )

    changes = {f: v for f, v in sent.items() if getattr(item, f) != v}
    if not changes:
        return item

    old_all = {f: getattr(item, f) for f in changes}
    ok = guarded_update(db, item, changes, WorkItem.version == data.version)
    if not ok:
        raise conflict(db, item, "This item was changed by someone else.")

    if "priority" in changes:
        record(
            db, item, actor, ItemEventType.PRIORITY_CHANGED,
            {"priority": old_all["priority"]}, {"priority": changes["priority"]},
            _urgent_unclaimed(item) if changes["priority"] == WorkItemPriority.URGENT else None,
        )
    if "requires_approval" in changes:
        record(
            db, item, actor, ItemEventType.APPROVAL_REQUIREMENT_CHANGED,
            {"requires_approval": old_all["requires_approval"]},
            {"requires_approval": changes["requires_approval"]},
        )
    edited = {f: v for f, v in changes.items() if f in EDIT_FIELDS}
    if edited:
        record(
            db, item, actor, ItemEventType.EDITED,
            {f: old_all[f] for f in edited}, edited,
        )
    return item


@dataclass(frozen=True)
class Rule:
    action: str
    min_role: TeamRole
    owner_only: bool = False
    needs_approval_flag: bool | None = None
    approver: bool = False
    comment_required: bool = False


S = WorkItemState
TRANSITIONS: dict[tuple[WorkItemState, WorkItemState], Rule] = {
    (S.IN_PROGRESS, S.PENDING_APPROVAL): Rule(
        "submit_for_approval", TeamRole.MEMBER, owner_only=True, needs_approval_flag=True
    ),
    (S.IN_PROGRESS, S.RESOLVED): Rule(
        "resolve", TeamRole.MEMBER, owner_only=True, needs_approval_flag=False
    ),
    (S.PENDING_APPROVAL, S.RESOLVED): Rule("approve", TeamRole.MANAGER, approver=True),
    (S.PENDING_APPROVAL, S.IN_PROGRESS): Rule(
        "reject", TeamRole.MANAGER, approver=True, comment_required=True
    ),
    (S.RESOLVED, S.CLOSED): Rule("close", TeamRole.MANAGER),
    (S.RESOLVED, S.IN_PROGRESS): Rule("reopen", TeamRole.MEMBER, comment_required=True),
}


def transition(db: Session, ctx: ItemContext, data: TransitionRequest) -> WorkItem:
    item, actor = ctx.item, ctx.user
    check_version(db, item, data.version)

    rule = TRANSITIONS.get((item.state, data.to_state))
    if rule is None:
        raise unprocessable(
            f"Transition {item.state.value} -> {data.to_state.value} is not allowed."
        )
    require_role(ctx.membership, rule.min_role, f"Your role cannot {rule.action}.")
    if rule.owner_only and item.owner_id != actor.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the owner can do this."
        )
    if rule.approver and actor.id in (item.owner_id, item.created_by_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="The approver cannot be the owner or creator of this item.",
        )
    if rule.needs_approval_flag is not None:
        if item.requires_approval != rule.needs_approval_flag:
            raise unprocessable(
                "This item requires approval: submit it for approval."
                if item.requires_approval
                else "This item does not require approval."
            )
    comment = (data.comment or "").strip()
    if rule.comment_required and not comment:
        raise unprocessable("A comment is required for this transition.")

    from_state = item.state
    ok = guarded_update(
        db,
        item,
        {"state": data.to_state},
        WorkItem.version == data.version,
        WorkItem.state == from_state,
    )
    if not ok:
        raise conflict(db, item, "This item was changed by someone else.")

    if comment:
        db.add(Comment(work_item_id=item.id, author_id=actor.id, body=comment))
    record(
        db,
        item,
        actor,
        ItemEventType.STATE_CHANGED,
        {"state": from_state},
        {"state": data.to_state, "action": rule.action, "comment": comment or None},
        [
            (
                "item.state_changed",
                {
                    "from_state": from_state,
                    "to_state": data.to_state,
                    "action": rule.action,
                },
            )
        ],
    )
    return item


def add_comment(db: Session, ctx: ItemContext, body: str) -> Comment:
    require_role(ctx.membership, TeamRole.MEMBER, "Your role cannot comment.")
    comment = Comment(work_item_id=ctx.item.id, author_id=ctx.user.id, body=body)
    db.add(comment)
    db.flush()
    db.refresh(comment)
    record(
        db,
        ctx.item,
        ctx.user,
        ItemEventType.COMMENTED,
        None,
        {"comment_id": comment.id},
        [("item.commented", {})],
    )
    return comment


def now_utc() -> datetime:
    return datetime.now(timezone.utc)