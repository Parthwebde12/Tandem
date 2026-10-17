"""Create the initial OpsDesk schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "teams",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "memberships",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=7), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('viewer', 'member', 'manager', 'admin')", name="team_role"
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id", "team_id"),
    )
    op.create_table(
        "work_items",
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("state", sa.String(length=20), server_default="open", nullable=False),
        sa.Column(
            "priority", sa.String(length=10), server_default="medium", nullable=False
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=False),
        sa.Column(
            "requires_approval",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "type IN ('incident', 'customer_issue', 'payment', 'compliance', 'task')",
            name="work_item_type",
        ),
        sa.CheckConstraint(
            "state IN ('open', 'in_progress', 'pending_approval', 'resolved', 'closed')",
            name="work_item_state",
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'urgent')",
            name="work_item_priority",
        ),
        sa.CheckConstraint("version >= 1", name="ck_work_items_version_positive"),
        sa.CheckConstraint(
            "(state = 'open' AND owner_id IS NULL) OR "
            "(state != 'open' AND owner_id IS NOT NULL)",
            name="ck_work_items_state_owner_consistent",
        ),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_work_items_team_created", "work_items", ["team_id", "created_at", "id"]
    )
    op.create_index("ix_work_items_team_state", "work_items", ["team_id", "state"])
    op.create_index(
        "ix_work_items_team_unclaimed_urgent",
        "work_items",
        ["team_id", "created_at", "id"],
        postgresql_where=sa.text(
            "owner_id IS NULL AND priority = 'urgent' AND state = 'open'"
        ),
    )
    op.create_index(
        "ix_work_items_owner_urgent",
        "work_items",
        ["owner_id", "team_id", "created_at", "id"],
        postgresql_where=sa.text("owner_id IS NOT NULL AND priority = 'urgent'"),
    )
    op.create_index(
        "ix_work_items_owner_due",
        "work_items",
        ["owner_id", "due_at", "id"],
        postgresql_where=sa.text(
            "owner_id IS NOT NULL AND due_at IS NOT NULL "
            "AND state IN ('in_progress', 'pending_approval')"
        ),
    )
    op.create_index(
        "ix_work_items_search",
        "work_items",
        [
            sa.text(
                "to_tsvector('english', "
                "coalesce(title, '') || ' ' || coalesce(description, ''))"
            )
        ],
        postgresql_using="gin",
    )
    op.create_table(
        "item_events",
        sa.Column("work_item_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("old_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "event_type IN ('created', 'claimed', 'released', 'assigned', "
            "'priority_changed', 'state_changed', 'edited', 'commented', "
            "'approval_requirement_changed')",
            name="item_event_type",
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["work_item_id"], ["work_items.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_item_events_item_created", "item_events", ["work_item_id", "created_at"]
    )
    op.create_table(
        "comments",
        sa.Column("work_item_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["work_item_id"], ["work_items.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_comments_item_created", "comments", ["work_item_id", "created_at"]
    )
    op.create_table(
        "outbox_events",
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("aggregate_type", sa.String(length=100), nullable=False),
        sa.Column("aggregate_id", sa.Uuid(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "available_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_outbox_events_pending",
        "outbox_events",
        ["processed_at", "available_at"],
    )
    op.create_table(
        "idempotency_keys",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column(
            "response_body", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key", name="uq_idempotency_user_key"),
    )

    op.execute(
        """
        CREATE FUNCTION prevent_item_event_mutation()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'item_events are append-only'
                USING ERRCODE = '55000';
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_item_events_immutable
        BEFORE UPDATE OR DELETE ON item_events
        FOR EACH ROW EXECUTE FUNCTION prevent_item_event_mutation()
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_item_events_no_truncate
        BEFORE TRUNCATE ON item_events
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_item_event_mutation()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_item_events_no_truncate ON item_events")
    op.execute("DROP TRIGGER trg_item_events_immutable ON item_events")
    op.execute("DROP FUNCTION prevent_item_event_mutation()")
    op.drop_table("idempotency_keys")
    op.drop_index("ix_outbox_events_pending", table_name="outbox_events")
    op.drop_table("outbox_events")
    op.drop_index("ix_comments_item_created", table_name="comments")
    op.drop_table("comments")
    op.drop_index("ix_item_events_item_created", table_name="item_events")
    op.drop_table("item_events")
    op.drop_index("ix_work_items_search", table_name="work_items")
    op.drop_index("ix_work_items_owner_due", table_name="work_items")
    op.drop_index("ix_work_items_owner_urgent", table_name="work_items")
    op.drop_index("ix_work_items_team_unclaimed_urgent", table_name="work_items")
    op.drop_index("ix_work_items_team_state", table_name="work_items")
    op.drop_index("ix_work_items_team_created", table_name="work_items")
    op.drop_table("work_items")
    op.drop_table("memberships")
    op.drop_table("teams")
    op.drop_table("users")
