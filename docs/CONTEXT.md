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
  - Project repo created (backend/, frontend/, docs/)
  - docs/SPEC.md drafted; decisions made in section 10 (approver is not owner/creator, closed is terminal, urgent unclaimed items notify managers/admins, requires_approval changeable by manager/admin only and not after pending_approval)
  - docs/INVARIANTS.md written (11 invariants)
  - docker-compose.yml with Postgres
  - FastAPI skeleton: config.py, db.py (session per request), main.py with /health
- Now: writing SQLAlchemy models in backend/app/models.py (User, Team, Membership, WorkItem, ItemEvent, Comment)
- Next: Alembic migration, seed users/teams, JWT auth, permission checks