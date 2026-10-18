# OpsDesk

OpsDesk is an internal operations workspace for coordinating incidents,
customer issues, payments, compliance work, and team tasks. It brings clear
ownership, next steps, audit history, and role-aware workflows into one place.

The repository contains a FastAPI and PostgreSQL backend and a React,
TypeScript, and TanStack Query frontend. The public landing page is an
illustrative product preview; actual team data is available only after sign-in
and is scoped by backend membership checks.

## Features

- Email and password sign-in with team memberships and role-based permissions.
- Work-item dashboard with status counts and attention queues.
- Searchable, filterable work-item list with cursor pagination.
- CSV export for work items currently loaded in the list.
- Per-user saved filter views stored in the current browser.
- Item creation, editing, assignment, claiming, release, and workflow
  transitions.
- Comments, append-only activity history, and in-app notifications.
- Optimistic claiming with server reconciliation when another user wins.
- Version-checked updates and idempotent write support in the API.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query.
- Backend: Python, FastAPI, SQLAlchemy, Alembic, Pydantic.
- Database: PostgreSQL.

## Local development

### Prerequisites

- Git
- Python 3.11 or newer
- Node.js supported by Vite 8
- Docker Desktop with Docker Compose

### 1. Start PostgreSQL

From the repository root:

```powershell
docker compose up -d db
```

This starts the local PostgreSQL service on port `5433` and uses the Compose
volume for its data. Do not remove the volume to restart the service.

### 2. Configure and run the backend

In PowerShell from the repository root:

```powershell
Set-Location backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `JWT_SECRET` to a fresh, private random value. Keep
`.env` local; it is ignored by Git. Do not reuse the demo password or a
development JWT secret in a deployed environment.

Apply migrations, optionally seed local demo data, and start the API:

```powershell
python -m alembic upgrade head
python -m app.seed
python -m uvicorn app.main:app --reload --port 8000
```

The API is available at <http://localhost:8000>; interactive API docs are at
<http://localhost:8000/docs>.

### 3. Run the frontend

In a second PowerShell window from the repository root:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. The Vite development server forwards `/api`
requests to the backend at `localhost:8000`.

### Demo account

The local seed command creates sample users. The login page’s demo button uses:

- Email: `alice@opsdesk.dev`
- Password: `password123`

Other seeded roles are listed in `backend/app/seed.py`. These shared credentials
are for local evaluation only. The seed command is a no-op if the database
already contains users; use a fresh local database when setting up demo data.
Never seed demo accounts into a production database.

## Tests and checks

Keep the local PostgreSQL service running. Backend tests use a separate
`opsdesk_test` database derived from `DATABASE_URL`; they do not target the
normal `opsdesk` database. The local database role needs permission to create
that test database.

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend production build and lint:

```powershell
Set-Location frontend
npm run build
npm run lint
```

## Repository layout

```text
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, and tests
docs/       Product specification, invariants, and project context
frontend/   React and TypeScript application
```

## Further reading

- [Product specification](docs/SPEC.md)
- [Workflow and permissions](docs/workflow.md)
- [System invariants](docs/INVARIANTS.md)
- [Project context and next steps](docs/CONTEXT.md)
