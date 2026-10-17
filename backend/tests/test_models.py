from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB

from app.models import ItemEvent, WorkItem


def test_work_item_requires_owner_outside_open_state() -> None:
    constraints = {
        constraint.name: str(constraint.sqltext)
        for constraint in WorkItem.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }

    assert constraints["ck_work_items_state_owner_consistent"] == (
        "(state = 'open' AND owner_id IS NULL) OR "
        "(state != 'open' AND owner_id IS NOT NULL)"
    )


def test_dashboard_indexes_are_partial() -> None:
    indexes = {index.name: index for index in WorkItem.__table__.indexes}

    assert indexes["ix_work_items_team_unclaimed_urgent"].dialect_options[
        "postgresql"
    ]["where"] is not None
    assert indexes["ix_work_items_owner_urgent"].dialect_options["postgresql"][
        "where"
    ] is not None
    assert indexes["ix_work_items_owner_due"].dialect_options["postgresql"][
        "where"
    ] is not None


def test_item_event_payloads_use_postgres_jsonb() -> None:
    assert isinstance(ItemEvent.__table__.c.old_value.type, JSONB)
    assert isinstance(ItemEvent.__table__.c.new_value.type, JSONB)
