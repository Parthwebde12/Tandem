# Project Context

## Project
OpsDesk is a simple shared task board for one team. Its distinguishing feature
is a required, visible next action on every task, making ownership and handoffs
clear without a heavyweight operations workflow.

## Stack
- Backend: FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Pydantic, pytest.
- Frontend: React, Vite, TypeScript, TanStack Query, Tailwind CSS.
- Local database: Docker Compose PostgreSQL on host port `5433`.

## How to work on this project
- Move one commit-sized step at a time; keep each change small and explain it
   plainly so I can understand it for a live review.
- Ask before expanding scope or adding complex features.
- Keep the source of truth in `docs/SPEC.md` and `docs/INVARIANTS.md`.
- The current MVP deliberately has no login and is for local/demo use only.
- Do not delete or reset the existing PostgreSQL volume.

## Current status
- Done: original project scaffold and schema are retained; migration
  `0002_simple_tasks` adds a separate table for the simplified task board.
- Done: basic task model, request/response schemas, and CRUD API routes.
- Now: completing the simple board UI, tests, and run instructions.
- Next: run migrations and test the whole local app; only then pick the next
  small feature based on what the demo needs.

## Local run settings
The Docker Compose database is published on host port `5433` to avoid the
existing PostgreSQL service on `5432`. Set `DATABASE_URL` in the ignored
`backend/.env` to `postgresql+psycopg://opsdesk:opsdesk@localhost:5433/opsdesk`.
Never commit or share `.env` values.
