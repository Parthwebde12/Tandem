# OpsDesk

Internal operations workspace for coordinating incidents, customer issues,
payments, compliance work and team tasks. Every work item has an owner, a next
action, an audit trail and role-aware workflows.

Built for the Newtonite Software Engineering Challenge. The focus is
**correctness under concurrency**: two people claiming the same item, stale
edits, retried requests and cross-team access are all handled in the backend
and covered by tests.

## Highlights

- **One winner per claim.** Claiming is a single conditional `UPDATE`; the
  database decides the race and the loser gets a `409` with the current item.
- **Version-checked edits.** Every update sends the `version` it saw, so a stale
  write can never overwrite newer data.
- **Idempotent writes.** `Idempotency-Key` is stored in the same transaction as
  the action, so retries and double clicks produce exactly one effect.
- **Audit history and notifications via a transactional outbox.** `item_events`
  is append-only (enforced by a database trigger); a worker turns outbox events
  into notifications with retries and no duplicates.
- **Server-side authorization.** Per-team roles (viewer, member, manager, admin).
  Non-members get `404`, so outsiders cannot tell an item exists.
- **Scalable reads.** Keyset pagination (max 100), PostgreSQL full-text search
  and indexed dashboard queries.

Frontend features: sign-in, dashboard, searchable and filterable item list,
item detail with comments and activity, create/edit/assign/claim/transition
controls, optimistic claim with conflict handling, notification bell,
per-user saved filter views (browser storage) and CSV export of the loaded list.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | PostgreSQL 16 (Docker Compose) |
| Tests | pytest + httpx against a real PostgreSQL test database |

## Quick start

Prerequisites: Git, Python 3.11+, Node.js (a version supported by Vite 8) and
Docker with Compose.

### 1. Start PostgreSQL

```bash
docker compose up -d db
```

PostgreSQL listens on host port `5433`. Do not delete the Compose volume.

### Optional: run the backend in Docker

```bash
cd backend
docker build -t opsdesk-api .
docker run --rm --env-file .env -p 8000:8000 opsdesk-api
```

This container expects PostgreSQL to be reachable at the value in `DATABASE_URL`.
If you are running the database from Docker Compose on the same machine, keep
using `localhost:5433` for local development.

### 2. Run the backend

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Windows (PowerShell):

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `JWT_SECRET` to a private random value
(for example `python -c "import secrets; print(secrets.token_urlsafe(48))"`).

Then migrate, seed and start the API:

```bash
python -m alembic upgrade head
python -m app.seed
python -m uvicorn app.main:app --reload --port 8000
```

API: <http://localhost:8000> - interactive docs: <http://localhost:8000/docs>

### 3. Run the outbox worker (separate terminal)

Notifications are created by a background worker. Without it, work items still
work but the notification bell stays empty.

```bash
cd backend
python -m app.worker
```

### 4. Run the frontend (separate terminal)

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `localhost:8000`.

## Demo accounts

`python -m app.seed` creates five users. All use the password `password123`.

| Account | Role | Teams |
|---|---|---|
| `alice@opsdesk.dev` | Admin | Support |
| `bob@opsdesk.dev` | Manager | Support (manager), Engineering (member) |
| `carol@opsdesk.dev` | Member | Support |
| `dave@opsdesk.dev` | Viewer | Support |
| `erin@opsdesk.dev` | Manager | Engineering |

These shared credentials exist only so reviewers can try each role. The seed is
a no-op if users already exist. Never use them, or this setup, with real data.

## Configuration

Set in `backend/.env` (see `backend/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | SQLAlchemy URL, default `postgresql+psycopg://opsdesk:opsdesk@localhost:5433/opsdesk` |
| `JWT_SECRET` | yes | Secret used to sign access tokens |
| `JWT_ALGORITHM` | no | JWT signing algorithm, default `HS256` |
| `ACCESS_TOKEN_MINUTES` | no | Token lifetime, default `60` |
| `CORS_ORIGINS` | no | Comma-separated allowed origins, empty by default (the dev proxy needs none) |
| `TEST_DATABASE_URL` | no | Optional override for the test database, usually a `_test` database name |

## Tests and checks

Keep PostgreSQL running. Tests use a separate `opsdesk_test` database derived
from `DATABASE_URL`, so your normal data is untouched. The database role must be
allowed to create databases.

```bash
cd backend
python -m pytest -q
```

```bash
cd frontend
npm run lint
npm run build
```

## API at a glance

| Area | Endpoints |
|---|---|
| Auth | login, `GET /auth/me` |
| Items | create, list/search/filter, detail, edit, claim, release, assign, transition |
| Collaboration | comments, activity events, notifications |
| Overview | dashboard summary |
| Ops | `GET /health` |

Full request and response details are in the interactive docs at `/docs`.

## Project layout

```text
backend/
  app/
    core/         settings and password/JWT helpers
    routers/      auth and items endpoints
    services/     work-item rules, queries, pagination, idempotency, outbox
    models.py     SQLAlchemy models
    worker.py     outbox worker
    seed.py       demo data
  alembic/        migrations 0001-0003
  tests/          API, model and permission tests
frontend/
  src/
    api/          typed API client
    auth/         auth context and provider
    components/   layout, item actions, dialogs, notifications
    features/     due status, CSV export, saved views
    pages/        preview, login, home, items, item detail
docs/             spec, workflow, invariants, project context
```

## Known limitations

- No team or member management screens; membership comes from the seed script.
- A manager cannot approve an item they created, so a one-manager team needs an
  admin for approvals.
- Notifications are in-app only and delivered by polling (30 s), not websockets
  or email.
- Failed idempotent requests are not stored and old keys are never cleaned up.
- Items cannot move between teams, and `closed` is terminal.
- No login rate limiting, refresh tokens or revocation; the token lives in
  `localStorage`.

## Further reading

- [Engineering decisions](Engineering_decision.md)
- [Product specification](docs/SPEC.md)
- [Workflow and permissions](docs/workflow.md)
- [System invariants](docs/INVARIANTS.md)
- [Project context](docs/CONTEXT.md)
