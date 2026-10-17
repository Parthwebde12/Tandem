"""Add the slim shared task board.

Revision ID: 0002_simple_tasks
Revises: 0001_initial
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_simple_tasks"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("next_action", sa.String(length=300), nullable=False),
        sa.Column("owner", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column(
            "priority", sa.String(length=10), server_default="normal", nullable=False
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_tasks_title_not_blank"),
        sa.CheckConstraint(
            "length(trim(next_action)) > 0",
            name="ck_tasks_next_action_not_blank",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'in_progress', 'done')", name="task_status"
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')", name="task_priority"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tasks_status_created", "tasks", ["status", "created_at", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_status_created", table_name="tasks")
    op.drop_table("tasks")
