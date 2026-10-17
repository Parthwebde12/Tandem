# OpsDesk

Internal operations work-item tracker: teams and roles, audit history, safe
concurrent updates (atomic claim, optimistic locking, idempotency).

Work in progress. See [docs/SPEC.md](docs/SPEC.md) and
[docs/CONTEXT.md](docs/CONTEXT.md). Full run instructions will be added at the end.

## Quick start (current)
```powershell
docker compose up -d db
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
```powershell
cd frontend
npm install
npm run dev
```