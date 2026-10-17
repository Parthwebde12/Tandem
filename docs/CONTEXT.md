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

## Current status (end of 17-10-2026)
- Done: docs, docker-compose, FastAPI skeleton (/health), models.py (User,
  Team, Membership, WorkItem, ItemEvent, Comment, OutboxEvent,
  IdempotencyKey), migrations 0001 + 0002 (next_action, append-only
  item_events trigger), seed script (python -m app.seed --bulk 200),
  JWT auth (POST /auth/login, GET /auth/me, get_current_user),
  frontend login + protected routes + app shell (teams and roles shown),
  team permission dependencies (404 without membership, centralized role
  checks; backend tests passing), workspace overview with team membership
  cards and a no-team empty state.
- Removed: the simple task-board experiment (no login, no teams).
- Now: transition function.

## Next (one commit each)
1. Transition function (audit event + outbox row in one transaction).
2. Atomic claim; versioned update (409).
3. Idempotency keys.
4. Comments, events, keyset list, search, dashboard endpoints.
5. Outbox worker with retries.
6. Tests on Postgres: concurrent claim, stale 409, idempotency, authz.
7. Frontend: work-item list, item detail, optimistic claim with 409 handling.
8. ENGINEERING_DECISIONS.md, real README, known limitations.

## Known gaps to mention in limitations
- No login rate limiting; no refresh tokens or logout endpoint (tokens expire after 60 min).
- Token stored in localStorage (XSS risk); an httpOnly cookie would be safer.
- Seed users share a demo password; the seed must not run in production.