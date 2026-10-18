import os
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core.config import settings

configured_test_url = os.environ.get("TEST_DATABASE_URL")
database_url = make_url(configured_test_url or settings.database_url)
database_name = database_url.database
if not database_name:
    raise RuntimeError("The test database URL must include a database name.")

if configured_test_url:
    if not database_name.endswith("_test"):
        raise RuntimeError("TEST_DATABASE_URL must target a database ending in '_test'.")
elif not database_name.endswith("_test"):
    database_url = database_url.set(database=f"{database_name}_test")

test_database_url = database_url.render_as_string(hide_password=False)
os.environ["DATABASE_URL"] = test_database_url
settings.database_url = test_database_url


@pytest.fixture(scope="session")
def migrated_test_database() -> None:
    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    alembic_config = Config(str(backend_dir / "alembic.ini"))
    command.upgrade(alembic_config, "head")


@pytest.fixture
def db_clean(migrated_test_database: None) -> None:
    import app.models  # noqa: F401
    from app.db import Base, engine

    tables = sorted(
        (table for table in Base.metadata.sorted_tables if table.name != "alembic_version"),
        key=lambda table: table.name,
    )
    if not tables:
        raise RuntimeError("No application tables are registered for test cleanup.")

    preparer = engine.dialect.identifier_preparer
    table_names = ", ".join(
        f"{preparer.quote(table.schema)}.{preparer.quote(table.name)}"
        if table.schema
        else preparer.quote(table.name)
        for table in tables
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE item_events "
                "DISABLE TRIGGER trg_item_events_no_truncate"
            )
        )
        connection.execute(
            text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE")
        )
        connection.execute(
            text(
                "ALTER TABLE item_events "
                "ENABLE TRIGGER trg_item_events_no_truncate"
            )
        )
