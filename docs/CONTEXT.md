# Context 

## Project
OpsDesk: internal operations work-item tracker for the Newtonite Software Engineering Challenge.
Deadline: Monday 12am. I must be able to explain and modify every part in a live review.

## Stack
FastAPI, SQLAlchemy 2.0 (sync), Alembic, PostgreSQL, Pydantic v2, pytest;
React + Vite + TypeScript + TanStack Query + Tailwind; Docker Compose.

## How I want you to help
- Explain options and trade-offs first; wait for my choice.
- Do NOT write the critical code (claim, versioning, idempotency, state machine, authz).
  Review mine for races, missing authz checks and transaction mistakes.
- Boilerplate (Docker, seed data, UI layout) you may generate.
- Keep answers short; use my file paths.
- Give files as copy-paste code blocks, never zip files.

## Conventions
- Routers are thin; business rules live in backend/app/services/.
- All state changes go through one transition function, in ONE transaction,
  writing an audit event (and an outbox row).
- Keyset pagination only.
- Source of truth: docs/SPEC.md and docs/INVARIANTS.md.

## Current status (update after each session)
- Done:
  - Repo created (backend/, frontend/, docs/)
  - docs/SPEC.md + docs/INVARIANTS.md (11 invariants); decisions in SPEC section 10
  - docker-compose.yml with Postgres 16
  - FastAPI skeleton: config.py, db.py (session per request), main.py with /health
  - backend/app/models.py: User, Team, Membership, WorkItem, ItemEvent, Comment, OutboxEvent, IdempotencyKey (JSONB for event/outbox/response payloads)
  - Commit 3 schema hardening: state/owner consistency constraint, immutable item-event triggers, dashboard partial indexes, and initial Alembic migration
  - frontend scaffold: Vite + React + TS + Tailwind v4 + TanStack Query + React Router; /api proxy to :8000; api/types.ts mirrors backend enums; Home page shows API health
- Now: Apply and verify the initial migration against local PostgreSQL (offline SQL generation and model tests pass; Docker was unavailable during verification)
- Next: Seed demo users/teams, then build JWT authentication; review authorization before implementation
