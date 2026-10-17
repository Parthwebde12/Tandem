"""Add next_action and make item_events append-only.

Revision ID: 0002_hardening
Revises: 0001_initial
Create Date: 2026-10-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_hardening"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "work_items",
        sa.Column(
            "next_action",
            sa.String(length=300),
            server_default="Needs triage",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_work_items_next_action_not_blank",
        "work_items",
        "length(trim(next_action)) > 0",
    )

    op.execute(
        """
        CREATE FUNCTION forbid_item_event_change() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'item_events is append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_item_events_append_only
        BEFORE UPDATE OR DELETE ON item_events
        FOR EACH ROW EXECUTE FUNCTION forbid_item_event_change();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_item_events_append_only ON item_events")
    op.execute("DROP FUNCTION IF EXISTS forbid_item_event_change()")
    op.drop_constraint(
        "ck_work_items_next_action_not_blank", "work_items", type_="check"
    )
    op.drop_column("work_items", "next_action")