"""Read-side queries: team-scoped list/search (keyset) and the dashboard."""

from uuid import UUID

from sqlalchemy import DateTime, Uuid, and_, func, literal, literal_column, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Membership,
    TeamRole,
    User,
    WorkItem,
    WorkItemPriority,
    WorkItemState,
    WorkItemType,
)
from app.schemas import DashboardBucket, DashboardRead, ItemRead, Page
from app.services.pagination import decode_cursor, encode_cursor

SEARCH_VECTOR = literal_column(
    "to_tsvector('english', "
    "coalesce(work_items.title, '') || ' ' || coalesce(work_items.description, ''))"
)
OPEN_STATES = (WorkItemState.OPEN, WorkItemState.IN_PROGRESS, WorkItemState.PENDING_APPROVAL)
ITEM_LOAD = (selectinload(WorkItem.owner), selectinload(WorkItem.creator))


def my_team_ids(user: User):
    return select(Membership.team_id).where(Membership.user_id == user.id)


def keyset_after(created_at_col, id_col, cursor: str):
    cur_dt, cur_id = decode_cursor(cursor)
    return or_(
        created_at_col < literal(cur_dt, DateTime(timezone=True)),
        and_(
            created_at_col == literal(cur_dt, DateTime(timezone=True)),
            id_col < literal(cur_id, Uuid()),
        ),
    )


def list_items(
    db: Session,
    user: User,
    *,
    team_id: UUID | None,
    states: list[WorkItemState] | None,
    priorities: list[WorkItemPriority] | None,
    types: list[WorkItemType] | None,
    owner_id: UUID | None,
    mine: bool,
    unassigned: bool,
    overdue: bool,
    q: str | None,
    limit: int,
    cursor: str | None,
) -> Page[ItemRead]:
    stmt = select(WorkItem).options(*ITEM_LOAD)
    if team_id is not None:
        stmt = stmt.where(WorkItem.team_id == team_id)
    else:
        stmt = stmt.where(WorkItem.team_id.in_(my_team_ids(user)))
    if states:
        stmt = stmt.where(WorkItem.state.in_(states))
    if priorities:
        stmt = stmt.where(WorkItem.priority.in_(priorities))
    if types:
        stmt = stmt.where(WorkItem.type.in_(types))
    if mine:
        stmt = stmt.where(WorkItem.owner_id == user.id)
    elif owner_id is not None:
        stmt = stmt.where(WorkItem.owner_id == owner_id)
    if unassigned:
        stmt = stmt.where(WorkItem.owner_id.is_(None))
    if overdue:
        stmt = stmt.where(
            WorkItem.due_at < func.now(), WorkItem.state.in_(OPEN_STATES)
        )
    if q and q.strip():
        stmt = stmt.where(SEARCH_VECTOR.op("@@")(func.plainto_tsquery("english", q)))
    if cursor:
        stmt = stmt.where(keyset_after(WorkItem.created_at, WorkItem.id, cursor))

    rows = db.scalars(
        stmt.order_by(WorkItem.created_at.desc(), WorkItem.id.desc()).limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    return Page[ItemRead](
        items=[ItemRead.model_validate(r) for r in rows],
        next_cursor=encode_cursor(rows[-1].created_at, rows[-1].id)
        if has_more and rows
        else None,
    )


def _bucket(db: Session, where: list, order, limit: int = 10) -> DashboardBucket:
    total = db.scalar(select(func.count()).select_from(WorkItem).where(*where)) or 0
    rows = db.scalars(
        select(WorkItem).options(*ITEM_LOAD).where(*where).order_by(*order).limit(limit)
    ).all()
    return DashboardBucket(total=total, items=[ItemRead.model_validate(r) for r in rows])


def dashboard(db: Session, user: User) -> DashboardRead:
    scope = WorkItem.team_id.in_(my_team_ids(user))
    manager_teams = select(Membership.team_id).where(
        Membership.user_id == user.id,
        Membership.role.in_([TeamRole.MANAGER, TeamRole.ADMIN]),
    )

    counts = dict(
        db.execute(
            select(WorkItem.state, func.count()).where(scope).group_by(WorkItem.state)
        ).all()
    )
    counts_by_state = {s.value: counts.get(s, 0) for s in WorkItemState}

    return DashboardRead(
        counts_by_state=counts_by_state,
        overdue_mine=_bucket(
            db,
            [
                WorkItem.owner_id == user.id,
                WorkItem.due_at < func.now(),
                WorkItem.state.in_(OPEN_STATES),
            ],
            [WorkItem.due_at.asc(), WorkItem.id],
        ),
        urgent_mine=_bucket(
            db,
            [
                WorkItem.owner_id == user.id,
                WorkItem.priority == WorkItemPriority.URGENT,
                WorkItem.state.in_(OPEN_STATES),
            ],
            [WorkItem.created_at.desc(), WorkItem.id.desc()],
        ),
        awaiting_my_approval=_bucket(
            db,
            [
                WorkItem.team_id.in_(manager_teams),
                WorkItem.state == WorkItemState.PENDING_APPROVAL,
                WorkItem.owner_id != user.id,
                WorkItem.created_by_id != user.id,
            ],
            [WorkItem.updated_at.asc(), WorkItem.id],
        ),
        unclaimed_urgent=_bucket(
            db,
            [
                scope,
                WorkItem.owner_id.is_(None),
                WorkItem.priority == WorkItemPriority.URGENT,
                WorkItem.state == WorkItemState.OPEN,
            ],
            [WorkItem.created_at.desc(), WorkItem.id.desc()],
        ),
    )