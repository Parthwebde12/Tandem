from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DatabaseSession, ItemAccess, TeamMembership
from app.models import (
    Comment,
    ItemEvent,
    Membership,
    Notification,
    User,
    WorkItemPriority,
    WorkItemState,
    WorkItemType,
)
from app.schemas import (
    AssignRequest,
    CommentCreate,
    CommentRead,
    DashboardRead,
    EventRead,
    ItemCreate,
    ItemRead,
    ItemUpdate,
    MemberRead,
    NotificationRead,
    Page,
    TransitionRequest,
    VersionedRequest,
)
from app.services import queries, work_items
from app.services.idempotency import fingerprint, run_idempotent
from app.services.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    encode_cursor,
)

router = APIRouter(tags=["work items"])

IdempotencyKey = Annotated[
    str | None, Header(min_length=1, max_length=255, description="Makes retries safe")
]
Limit = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)]


def item_json(item) -> ItemRead:
    return ItemRead.model_validate(item)


@router.get("/teams/{team_id}/members", response_model=list[MemberRead])
def list_members(team_id: UUID, membership: TeamMembership, db: DatabaseSession):
    rows = db.execute(
        select(User.id, User.full_name, User.email, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.team_id == team_id, User.is_active.is_(True))
        .order_by(User.full_name)
    ).all()
    return [
        MemberRead(user_id=r.id, full_name=r.full_name, email=r.email, role=r.role)
        for r in rows
    ]


@router.post(
    "/teams/{team_id}/items", response_model=ItemRead, status_code=status.HTTP_201_CREATED
)
def create_item(
    team_id: UUID,
    payload: ItemCreate,
    request: Request,
    membership: TeamMembership,
    user: CurrentUser,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: item_json(work_items.create_item(db, user, membership, team_id, payload)),
        status.HTTP_201_CREATED,
    )


@router.get("/items", response_model=Page[ItemRead])
def list_items(
    user: CurrentUser,
    db: DatabaseSession,
    team_id: UUID | None = None,
    state: Annotated[list[WorkItemState] | None, Query()] = None,
    priority: Annotated[list[WorkItemPriority] | None, Query()] = None,
    type: Annotated[list[WorkItemType] | None, Query()] = None,
    owner_id: UUID | None = None,
    mine: bool = False,
    unassigned: bool = False,
    overdue: bool = False,
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Limit = DEFAULT_PAGE_SIZE,
    cursor: str | None = None,
):
    if team_id is not None and db.get(Membership, (user.id, team_id)) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Team not found.")
    return queries.list_items(
        db,
        user,
        team_id=team_id,
        states=state,
        priorities=priority,
        types=type,
        owner_id=owner_id,
        mine=mine,
        unassigned=unassigned,
        overdue=overdue,
        q=q,
        limit=limit,
        cursor=cursor,
    )


@router.get("/dashboard", response_model=DashboardRead)
def get_dashboard(user: CurrentUser, db: DatabaseSession):
    return queries.dashboard(db, user)


@router.get("/items/{item_id}", response_model=ItemRead)
def get_item(ctx: ItemAccess):
    return item_json(ctx.item)


@router.get("/items/{item_id}/events", response_model=Page[EventRead])
def list_events(
    ctx: ItemAccess,
    db: DatabaseSession,
    limit: Limit = 50,
    cursor: str | None = None,
):
    stmt = (
        select(ItemEvent)
        .options(selectinload(ItemEvent.actor))
        .where(ItemEvent.work_item_id == ctx.item.id)
    )
    if cursor:
        stmt = stmt.where(queries.keyset_after(ItemEvent.created_at, ItemEvent.id, cursor))
    rows = db.scalars(
        stmt.order_by(ItemEvent.created_at.desc(), ItemEvent.id.desc()).limit(limit + 1)
    ).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return Page[EventRead](
        items=[EventRead.model_validate(r) for r in rows],
        next_cursor=encode_cursor(rows[-1].created_at, rows[-1].id) if more and rows else None,
    )


@router.get("/items/{item_id}/comments", response_model=Page[CommentRead])
def list_comments(
    ctx: ItemAccess,
    db: DatabaseSession,
    limit: Limit = 50,
    cursor: str | None = None,
):
    stmt = (
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.work_item_id == ctx.item.id)
    )
    if cursor:
        stmt = stmt.where(queries.keyset_after(Comment.created_at, Comment.id, cursor))
    rows = db.scalars(
        stmt.order_by(Comment.created_at.desc(), Comment.id.desc()).limit(limit + 1)
    ).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return Page[CommentRead](
        items=[CommentRead.model_validate(r) for r in rows],
        next_cursor=encode_cursor(rows[-1].created_at, rows[-1].id) if more and rows else None,
    )


@router.post("/items/{item_id}/comments", response_model=CommentRead, status_code=201)
def add_comment(
    payload: CommentCreate,
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: CommentRead.model_validate(work_items.add_comment(db, ctx, payload.body)),
        status.HTTP_201_CREATED,
    )


@router.patch("/items/{item_id}", response_model=ItemRead)
def update_item(
    payload: ItemUpdate,
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: item_json(work_items.update_fields(db, ctx, payload)),
    )


@router.post("/items/{item_id}/claim", response_model=ItemRead)
def claim_item(
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, None),
        lambda: item_json(work_items.claim(db, ctx)),
    )


@router.post("/items/{item_id}/release", response_model=ItemRead)
def release_item(
    payload: VersionedRequest,
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: item_json(work_items.release(db, ctx, payload.version)),
    )


@router.post("/items/{item_id}/assign", response_model=ItemRead)
def assign_item(
    payload: AssignRequest,
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: item_json(
            work_items.assign(db, ctx, payload.version, payload.assignee_id)
        ),
    )


@router.post("/items/{item_id}/transition", response_model=ItemRead)
def transition_item(
    payload: TransitionRequest,
    request: Request,
    ctx: ItemAccess,
    db: DatabaseSession,
    idempotency_key: IdempotencyKey = None,
) -> JSONResponse:
    return run_idempotent(
        db,
        ctx.user,
        idempotency_key,
        fingerprint(request, payload),
        lambda: item_json(work_items.transition(db, ctx, payload)),
    )


@router.get("/notifications", response_model=Page[NotificationRead])
def list_notifications(
    user: CurrentUser,
    db: DatabaseSession,
    limit: Limit = 25,
    cursor: str | None = None,
):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if cursor:
        stmt = stmt.where(
            queries.keyset_after(Notification.created_at, Notification.id, cursor)
        )
    rows = db.scalars(
        stmt.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1)
    ).all()
    more = len(rows) > limit
    rows = rows[:limit]
    return Page[NotificationRead](
        items=[NotificationRead.model_validate(r) for r in rows],
        next_cursor=encode_cursor(rows[-1].created_at, rows[-1].id) if more and rows else None,
    )


@router.post("/notifications/{notification_id}/read", status_code=204)
def mark_notification_read(
    notification_id: UUID, user: CurrentUser, db: DatabaseSession
) -> None:
    result = db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user.id)
        .values(read_at=func.coalesce(Notification.read_at, func.now()))
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notification not found.")