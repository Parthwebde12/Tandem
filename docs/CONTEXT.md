# Project Context

## Project
OpsDesk is an internal web app for coordinating operational work (incidents,
customer issues, payments, compliance, tasks) across teams. Built for the
Newtonite Software Engineering Challenge (internship assignment).
Deadline: Monday 12am. I must be able to explain and modify every part live.

Deliverables: working code, run instructions, ENGINEERING_DECISIONS.md
(~5 decisions + trade-offs), automated tests, known limitations, live demo.

## Stack
- Backend: FastAPI, SQLAlchemy 2 (sync), Alembic, PostgreSQL, Pydantic v2, pytest.
- Frontend: React, Vite, TypeScript, TanStack Query, Tailwind CSS.
- Local database: Docker Compose PostgreSQL on host port 5433
  (DATABASE_URL in ignored backend/.env). Never commit .env values.

## How to work on this project
- One small commit per step, with a LEARNING_LOG.md line each.
- I write the critical code (claim, versioning, idempotency, state machine,
  authz); Claude reviews it. Boilerplate, seed and UI layout can be generated.
- Source of truth: docs/SPEC.md and docs/INVARIANTS.md.
- Ask before expanding scope. No MCP unless everything else is finished.
- Do not delete or reset the existing PostgreSQL volume.

## Current status
- Done: docs, docker-compose, FastAPI skeleton (/health), models.py (User,
  Team, Membership, WorkItem, ItemEvent, Comment, OutboxEvent,
  IdempotencyKey), migration 0001, frontend scaffold (health page).
- Removed: the simple task-board experiment (no login, no teams).
- Now: migration 0002 (hardening + next_action).

## Next (one commit each)
1. Migration 0002: state/owner CheckConstraint, item_events immutability
   trigger, dashboard indexes, next_action column.
2. Seed script (2 teams, 4 roles, one multi-team user, varied items).
3. JWT auth (login, get_current_user).
4. Permission helper (404 for non-members, role checks).
5. Transition function (audit + outbox in one transaction).
6. Atomic claim; versioned update (409).
7. Idempotency keys.
8. Comments, events, keyset list, search, dashboard.
9. Outbox worker with retries.
10. Tests on Postgres: concurrent claim, stale 409, idempotency, authz.
11. Frontend: login, dashboard, list, detail, optimistic claim.
12. ENGINEERING_DECISIONS.md, real README, known limitations.