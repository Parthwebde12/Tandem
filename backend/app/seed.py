

import argparse
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select

from app.db import SessionLocal
from app.models import (
    ItemEvent,
    ItemEventType,
    Membership,
    Team,
    TeamRole,
    User,
    WorkItem,
    WorkItemPriority,
    WorkItemState,
    WorkItemType,
)

PASSWORD = "password123"


def make_user(email: str, full_name: str, password_hash: str) -> User:
    return User(email=email, full_name=full_name, password_hash=password_hash)


def add_item(
    db,
    *,
    team: Team,
    creator: User,
    title: str,
    type: WorkItemType,
    state: WorkItemState,
    priority: WorkItemPriority,
    next_action: str,
    owner: User | None = None,
    requires_approval: bool = False,
    due_at: datetime | None = None,
    description: str | None = None,
    created_at: datetime | None = None,
) -> WorkItem:
    item = WorkItem(
        team_id=team.id,
        title=title,
        description=description,
        type=type,
        state=state,
        priority=priority,
        next_action=next_action,
        owner_id=owner.id if owner else None,
        created_by_id=creator.id,
        requires_approval=requires_approval,
        due_at=due_at,
    )
    if created_at is not None:
        item.created_at = created_at
    db.add(item)
    db.flush()

    db.add(
        ItemEvent(
            work_item_id=item.id,
            actor_id=creator.id,
            event_type=ItemEventType.CREATED,
            old_value=None,
            new_value={"title": title, "priority": priority.value},
        )
    )
    if owner is not None:
        db.add(
            ItemEvent(
                work_item_id=item.id,
                actor_id=owner.id,
                event_type=ItemEventType.CLAIMED,
                old_value={"owner_id": None},
                new_value={"owner_id": str(owner.id)},
            )
        )
    return item


def seed(bulk: int) -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            print("Database already has users; seed skipped.")
            return

        pw = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
        alice = make_user("alice@opsdesk.dev", "Alice Admin", pw)
        bob = make_user("bob@opsdesk.dev", "Bob Manager", pw)
        carol = make_user("carol@opsdesk.dev", "Carol Member", pw)
        dave = make_user("dave@opsdesk.dev", "Dave Viewer", pw)
        erin = make_user("erin@opsdesk.dev", "Erin Engineer", pw)
        db.add_all([alice, bob, carol, dave, erin])

        support = Team(name="Support")
        engineering = Team(name="Engineering")
        db.add_all([support, engineering])
        db.flush()

        db.add_all(
            [
                Membership(user_id=alice.id, team_id=support.id, role=TeamRole.ADMIN),
                Membership(user_id=bob.id, team_id=support.id, role=TeamRole.MANAGER),
                Membership(user_id=carol.id, team_id=support.id, role=TeamRole.MEMBER),
                Membership(user_id=dave.id, team_id=support.id, role=TeamRole.VIEWER),
                # Bob has a different role in a second team
                Membership(user_id=bob.id, team_id=engineering.id, role=TeamRole.MEMBER),
                Membership(user_id=erin.id, team_id=engineering.id, role=TeamRole.MANAGER),
            ]
        )

        add_item(
            db, team=support, creator=carol,
            title="Checkout page returns 500 for all customers",
            type=WorkItemType.INCIDENT, state=WorkItemState.OPEN,
            priority=WorkItemPriority.URGENT,
            next_action="Someone claim this and check the payment service logs",
            description="Started 10 minutes ago, affects every card payment.",
        )
        add_item(
            db, team=support, creator=bob,
            title="Customer reports duplicate charge",
            type=WorkItemType.CUSTOMER_ISSUE, state=WorkItemState.IN_PROGRESS,
            priority=WorkItemPriority.HIGH,
            next_action="Ask customer for the order number",
            owner=carol,
        )
        add_item(
            db, team=support, creator=carol,
            title="Refund of 4,500 for enterprise client",
            type=WorkItemType.PAYMENT, state=WorkItemState.PENDING_APPROVAL,
            priority=WorkItemPriority.HIGH,
            next_action="Manager to approve or reject the refund",
            owner=carol, requires_approval=True,
        )
        add_item(
            db, team=support, creator=alice,
            title="Quarterly compliance report is overdue",
            type=WorkItemType.COMPLIANCE, state=WorkItemState.IN_PROGRESS,
            priority=WorkItemPriority.MEDIUM,
            next_action="Collect the missing audit logs",
            owner=bob, due_at=now - timedelta(days=2),
        )
        add_item(
            db, team=support, creator=bob,
            title="Update the macOS setup guide",
            type=WorkItemType.TASK, state=WorkItemState.RESOLVED,
            priority=WorkItemPriority.LOW,
            next_action="Manager to close after review",
            owner=carol,
        )
        add_item(
            db, team=support, creator=alice,
            title="Rotate shared mailbox password",
            type=WorkItemType.TASK, state=WorkItemState.CLOSED,
            priority=WorkItemPriority.LOW,
            next_action="Nothing, completed",
            owner=bob,
        )
        add_item(
            db, team=engineering, creator=erin,
            title="Database CPU at 90 percent on replica",
            type=WorkItemType.INCIDENT, state=WorkItemState.OPEN,
            priority=WorkItemPriority.URGENT,
            next_action="Check slow query log",
        )

        priorities = list(WorkItemPriority)
        for i in range(bulk):
            add_item(
                db, team=support, creator=carol,
                title=f"Bulk item {i + 1}",
                type=WorkItemType.TASK, state=WorkItemState.OPEN,
                priority=priorities[i % len(priorities)],
                next_action="Triage",
                created_at=now - timedelta(minutes=i + 1),
            )

        db.commit()

    print("Seeded. Log in with any of these (password: %s):" % PASSWORD)
    print("  alice@opsdesk.dev  Support admin")
    print("  bob@opsdesk.dev    Support manager, Engineering member")
    print("  carol@opsdesk.dev  Support member")
    print("  dave@opsdesk.dev   Support viewer")
    print("  erin@opsdesk.dev   Engineering manager")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bulk", type=int, default=0, help="extra open items for pagination tests")
    args = parser.parse_args()
    seed(args.bulk)