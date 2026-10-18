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

## Current status (18-10-2026)
- Done: docs, docker-compose, models, migrations 0001-0003, seed, JWT auth, team
  permission dependencies, FULL BACKEND: items API (create,
  list/search/filter with keyset pagination, detail, edit with version check,
  claim, release, assign, transition), comments, events, dashboard,
  Idempotency-Key, notifications + outbox worker, tests on a separate Postgres DB.
- Frontend milestone 1 done: dashboard, filtered/searchable item list with
  pagination, item detail, activity history, and comments (including posting
  permissions for viewers vs. members).
- Frontend remaining: create/edit/assign/transition item controls; optimistic
  claim with 409 conflict handling; notifications bell and polling.

## Next (one commit each)
1. Frontend: item create/edit/assign/transition controls.
2. Frontend: optimistic claim with 409 handling, notifications bell, polling.
3. ENGINEERING_DECISIONS.md, real README, known limitations (see docs/WORKFLOW.md).
