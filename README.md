# OpsDesk

OpsDesk is a small team task board built around one simple question: **what is
the next action?** Every task has an owner (optional), priority, status, due
date (optional), and a required next step.

This MVP is intentionally small: one shared board, no login, and no external
services besides PostgreSQL. It is intended for local development and demos;
do not expose the unauthenticated API to the internet or an untrusted network.

## Requirements

- Python 3.11+
- Node.js 20+
- Docker Desktop with Docker Compose

## Configure

Copy `backend\.env.example` to `backend\.env`. Its local `DATABASE_URL` uses
port `5433`, matching `docker-compose.yml`. The database password is the
local Compose password; it is not a task-board user password.

## Run

From the repository root, start PostgreSQL:

```powershell
docker compose up -d db
```

In a backend terminal:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If `backend\.venv` does not exist yet, create it and install dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

In another terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
The Vite dev server proxies `/api` requests to the backend on port `8000`.

## Test

Backend, from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Frontend, from `frontend`:

```powershell
npm run lint
npm run build
```

See [docs/SPEC.md](docs/SPEC.md) for the MVP contract and [docs/CONTEXT.md](docs/CONTEXT.md)
for current project status.
