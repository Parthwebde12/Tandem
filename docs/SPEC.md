# OpsDesk: Simple Team Task Board

## Purpose
OpsDesk is a small shared board for one team to keep track of work. Each task
shows who owns it and, most importantly, what the next action is. The goal is
to make handoffs clear without a complex workflow.

## MVP scope
- One shared team board; no accounts or login in this local/demo MVP.
- Create, edit, search, filter, and delete tasks.
- Task status: `open`, `in_progress`, or `done`.
- Priority: `low`, `normal`, `high`, or `urgent`.
- Optional owner, due date, and details.
- Every task has a required title and required next action.
- PostgreSQL is the source of truth. Docker Compose publishes it at
  `localhost:5433`; the backend runs locally at `localhost:8000`.
- The API returns at most 100 tasks per request.
- The MVP is for local development/demo use only; do not expose the unauthenticated
  API to an untrusted network.

## Task fields
| Field | Meaning |
|---|---|
| id | UUID generated for the task |
| title | Short description, required, up to 200 characters |
| next_action | The next concrete step, required, up to 300 characters |
| details | Optional supporting context |
| owner | Optional teammate's name |
| status | `open`, `in_progress`, or `done` |
| priority | `low`, `normal`, `high`, or `urgent` |
| due_date | Optional calendar date |
| created_at, updated_at | Server timestamps |

## API
- `GET /tasks`: newest first; optional `status`, `search`, and `limit` filters.
- `POST /tasks`: create a task.
- `PATCH /tasks/{id}`: update one or more supplied fields.
- `DELETE /tasks/{id}`: delete a task.
- `GET /health`: database connectivity check.
- Invalid fields return 422; unknown task IDs return 404.

## Out of scope for MVP
Authentication and roles, multiple teams, approvals, comments, audit history,
notifications, idempotency, and concurrency/version handling. Reconsider these
only after the simple board works and the core user need is validated.

## Database compatibility
The original OpsDesk schema and its data are left untouched. Migration
`0002_simple_tasks` adds the new `tasks` table alongside the legacy tables.
