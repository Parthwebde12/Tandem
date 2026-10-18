# Engineering Decisions

**Project:** OpsDesk  
**Date:** 2026-10-18

This document records the main technical decisions behind OpsDesk and the
trade-offs they introduce.

## 1. FastAPI API with PostgreSQL as the source of truth

**Decision:** Keep the backend as a Python FastAPI application using SQLAlchemy
and Alembic, with PostgreSQL as the persistent data store.

**Why:** The domain relies on relational constraints, team memberships, audit
history, and atomic multi-record changes. PostgreSQL transactions and
constraints make those rules enforceable at the database boundary.

**Trade-offs:** This adds a database service and migration management to local
development and deployment. Synchronous SQLAlchemy is straightforward for the
current workload, but may need reconsideration if request concurrency or I/O
requirements grow substantially.

## 2. Team-scoped authorization with non-disclosing 404 responses

**Decision:** Check team membership in shared backend dependencies and return
404 when a user is not a member of the requested team or item.

**Why:** Centralized checks keep authorization consistent across endpoints and
avoid revealing whether another team's records exist.

**Trade-offs:** A caller receives less diagnostic detail when access is denied.
The API must continue to apply these checks server-side; hiding UI controls is
not an authorization boundary.

## 3. Atomic updates, version checks, and idempotency

**Decision:** Use conditional database updates for competing actions, require
the item's version for edits and transitions, and support `Idempotency-Key` on
write operations.

**Why:** Database-level conditions resolve races safely. Version checks prevent
stale clients from overwriting newer work, while idempotency prevents network
retries from duplicating supported writes.

**Trade-offs:** Clients must handle conflict responses and retry deliberately.
Idempotency adds database state and transaction complexity; it applies only to
requests that supply a key.

## 4. Audit events and notifications use a transactional outbox

**Decision:** Store an item's audit event and its outbox events in the same
transaction as the item change. Process outbox events separately and make
notification insertion idempotent.

**Why:** The item change and its audit record cannot commit independently. The
outbox allows notification work to be retried without losing the original
transaction.

**Trade-offs:** Notifications are eventually consistent and require a running
processor. Delivery can be attempted more than once, so consumers must retain
deduplication behavior. Notifications are currently polled by clients rather
than pushed over a real-time connection.

## 5. React and TypeScript frontend with a separate API origin

**Decision:** Build the frontend as a Vite React single-page application and
keep the API as a separately deployed FastAPI service. Configure the frontend
API origin at build time and restrict backend CORS to the deployed frontend
origin.

**Why:** Separate services allow each part to be built and deployed with its
own runtime while preserving a simple local Vite proxy for development.

**Trade-offs:** Deployment requires coordinated API URL and CORS settings.
Client-side route fallback must be configured for the static host. The current
bearer token is stored in browser `localStorage`, which makes protection
against same-origin script injection important.

## 6. Render as the initial deployment target

**Decision:** Use Render Static Site for the frontend, Render Web Service for
the API, and managed Render PostgreSQL for the database.

**Why:** This keeps the deployment close to the local architecture without
requiring a separately managed server.

**Trade-offs:** Service URLs and environment variables must be coordinated,
and the selected database plan determines backup and availability guarantees.
Deployment is not complete until migrations, health checks, CORS, and an
end-to-end sign-in flow are verified. The current shared demo credentials are
public, so they must only be used with fictional demo data and never as a
private production account.
