# Tandem

### Team-scoped work coordination with safe concurrent updates

Tandem is a full-stack operations workspace where teams coordinate incidents, customer issues, payments, compliance work and tasks. It gives every item a clear owner, a next step and a complete audit history, and it stays correct when many people act on the same work at the same time.

**[Live Demo](https://tandem-gules-chi.vercel.app)** · **[Repository](https://github.com/Parthwebde12/Tandem)**

## Features

- **Work Management** — Create, edit, assign, claim, release and track work items by state, priority, type, owner and due date, each with a required "next action".
- **Attention Dashboard** — Status counts plus queues for overdue work, urgent work, items awaiting my approval and urgent items nobody owns.
- **Search & Lists** — Full-text search, filters and cursor pagination on the server, so the browser never loads the whole dataset.
- **Team Collaboration** — Comments, append-only activity history and in-app notifications on every item.
- **Approval Workflow** — Guarded state transitions, optional approval step, comment-required rejections, and separation of duties (an approver cannot be the owner or creator).
- **Role-Based Access** — Per-team roles (viewer, member, manager, admin) enforced on the server; people outside a team cannot see that its items exist.
- **Data Integrity** — Atomic claiming, version-checked updates, idempotency keys and an append-only audit trail.
- **Reliable Async Work** — A transactional outbox and background worker turn changes into notifications, with retries and no duplicates.
- **Accounts** — One-click demo roles, or sign up with your own name and email and choose a team and role (demo mode).

## Product Preview

![Tandem dashboard](assets/dashboard.png)
![Tandem work items](assets/work-items.png)

## Architecture

The React app talks to the FastAPI API through an `/api` proxy using bearer tokens. The API verifies the user, applies team and role checks, and writes the change, its audit event and an outbox event in one database transaction. A separate worker processes the outbox.

```mermaid
flowchart LR
    Browser["React + TypeScript app (Vercel)"] -->|"/api, JWT bearer"| API["FastAPI API (Render)"]
    API -->|"SQLAlchemy"| DB[("PostgreSQL")]
    API -->|"same transaction as the change"| Outbox[("outbox_events")]
    Worker["Outbox worker"] -->|"FOR UPDATE SKIP LOCKED, retries"| Outbox
    Worker --> Notifications[("notifications")]
    Browser -->|"polls"| Notifications
```

## Database Schema

The model covers users, teams, memberships, work items, an append-only event history, comments, idempotency keys, the outbox and notifications.

```mermaid
erDiagram
    USERS ||--o{ MEMBERSHIPS : has
    TEAMS ||--o{ MEMBERSHIPS : has
    TEAMS ||--o{ WORK_ITEMS : owns
    USERS ||--o{ WORK_ITEMS : "creates and owns"
    WORK_ITEMS ||--o{ ITEM_EVENTS : "audit history"
    WORK_ITEMS ||--o{ COMMENTS : has
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ IDEMPOTENCY_KEYS : submits
    WORK_ITEMS ||--o{ OUTBOX_EVENTS : emits
    OUTBOX_EVENTS ||--o{ NOTIFICATIONS : produces
    USERS ||--o{ NOTIFICATIONS : receives
    WORK_ITEMS {
        uuid id PK
        uuid team_id FK
        string title
        string next_action
        string state
        string priority
        uuid owner_id FK
        boolean requires_approval
        int version
    }
```

Schema changes are maintained as Alembic migrations in `backend/alembic/versions/`.

## Technology Stack

| Layer                | Technologies                                                    |
| -------------------- | --------------------------------------------------------------- |
| Frontend             | React, TypeScript, React Router, Tailwind CSS, TanStack Query   |
| Build & Tooling      | Vite, ESLint                                                    |
| Backend              | Python, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic             |
| Authentication       | JWT (PyJWT), bcrypt password hashing                            |
| Database             | PostgreSQL 16 (row locks, JSONB, partial and full-text indexes) |
| Background Work      | Transactional outbox with a Python worker                       |
| Testing              | pytest, FastAPI TestClient, real PostgreSQL test database       |
| Local Infrastructure | Docker Compose                                                  |
| Deployment           | Vercel (frontend), Render (API)                                 |

## Engineering Highlights

### Authentication & Authorization

- JWTs carry only the user id; roles and memberships are loaded from the database on every request, so changes take effect immediately.
- One dependency loads an item together with the caller's team membership. An unknown item and a non-member both return `404`, so outsiders cannot learn that an item exists. Role limits return `403`.
- Workflow rules enforce separation of duties for approvals.

### Concurrency & Data Integrity

- **Atomic claim:** one conditional `UPDATE ... WHERE state = 'open' AND owner_id IS NULL`. Postgres row locking picks exactly one winner; everyone else gets `409` with the current item.
- **Optimistic locking:** every other change sends the item's `version`; stale writes are rejected with `409` and never overwrite newer data.
- **Idempotency keys:** the key is stored in the same transaction as the action, so double clicks, retries and lost responses cannot repeat it.
- **Audit history:** each change writes an event in the same transaction, and a database trigger blocks updates and deletes on events.

### Async Processing

Changes also write an outbox event. The worker claims rows with `FOR UPDATE SKIP LOCKED`, retries failures with exponential backoff, and creates notifications under a unique `(event, user)` key, so processing an event twice notifies once.

### Search & Pagination

Lists use keyset (cursor) pagination with a page limit of 100, PostgreSQL full-text search with a GIN index, and partial indexes behind the dashboard queries.

## Local Setup

### Prerequisites

- Git
- Python 3.11 or newer
- Node.js supported by Vite
- Docker Desktop with Docker Compose

### 1. Start PostgreSQL

From the repository root:

```powershell
docker compose up -d db
```

The database listens on port `5433`. Do not remove the Compose volume to restart it.

### 2. Configure the backend

```powershell
Set-Location backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://opsdesk:opsdesk@localhost:5433/opsdesk
JWT_SECRET=<a long random value, at least 32 characters>
OPEN_SIGNUP=true
```

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. `OPEN_SIGNUP=true` enables the demo sign-up page; leave it off for any real use.

### 3. Migrate and seed

```powershell
python -m alembic upgrade head
python -m app.seed --bulk 200
```

### 4. Run the API and the worker

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal (from `backend/`, virtual environment active):

```powershell
python -m app.worker
```

The API is at <http://localhost:8000> with interactive docs at <http://localhost:8000/docs>. Notifications only appear while the worker is running.

### 5. Run the frontend

In a third terminal from the repository root:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The dev server forwards `/api` to the backend.

### Accounts

On the login page, pick a demo role and press "Explore as ...", or open `/signup` to create your own account with your name and email and a team and role of your choice.

| Account | Role | Team access |
|---|---|---|
| `alice@opsdesk.dev` | Admin | Support |
| `bob@opsdesk.dev` | Manager | Support; member in Engineering |
| `carol@opsdesk.dev` | Member | Support |
| `dave@opsdesk.dev` | Viewer | Support |
| `erin@opsdesk.dev` | Manager | Engineering |

All seeded accounts use the password `password123`. They are shared demo credentials for fictional data only.

## Testing

Keep the local PostgreSQL service running. Backend tests use a separate `opsdesk_test` database that is created automatically, so your development data is not touched.

| Check | Command | Directory |
| ----- | ------- | --------- |
| Backend tests | `python -m pytest -q` | `backend/` |
| Frontend build and TypeScript checks | `npm run build` | `frontend/` |
| Frontend lint | `npm run lint` | `frontend/` |

The tests cover the behaviours that would be most dangerous if wrong: ten concurrent claims (exactly one wins), stale updates, duplicate requests with the same idempotency key, cross-team access, workflow and approval rules, audit immutability, pagination, and the worker's retry and duplicate handling.

## Security & Deployment Notes

- Sign-up lets a person pick their own role. That is for demo mode only (`OPEN_SIGNUP`, off by default); a real deployment would use admin invitations.
- Demo accounts and their shared password are for fictional data only. Remove them before any real use.
- There is no login rate limiting, refresh-token flow or token revocation, and the token is kept in browser storage.
- Notifications are stored in the app, not emailed, and the browser polls instead of using websockets.
- There are no member-management screens, items cannot be deleted (they are closed so history is kept), and `closed` is terminal.
- On the free hosting tier the API can take up to a minute to wake after being idle, and the background worker is not running there unless it is deployed separately.

Production load testing and scalability benchmarks have not been done.

## Further Reading

- [Engineering decisions](Engineering_decision.md)
- [Product specification](docs/SPEC.md)
- [Workflow and permissions](docs/workflow.md)
- [System invariants](docs/INVARIANTS.md)

---

**Built for the Newtonite Software Engineering Challenge.**