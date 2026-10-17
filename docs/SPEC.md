# OpsDesk: Operations Work Management

## Purpose
OpsDesk is an internal web app for coordinating incidents, customer issues,
payments, compliance work, and tasks across teams. Each work item records a
clear next action so teams can coordinate ownership and handoffs.

## Current implementation
- Users sign in with email and password. The API returns a bearer access token,
  and the frontend loads the current user and team memberships from `/auth/me`.
- The frontend protects the workspace behind authentication and provides a
  workspace overview with the signed-in user's teams and assigned roles.
- Users without team memberships see an explicit empty state.
- Team membership is checked by shared backend dependencies; non-members
  receive 404 and role-restricted access is checked centrally.
- Work-item, comment, event, and dashboard API endpoints are not implemented
  yet. The workspace overview does not display fabricated work-item data.
- PostgreSQL is the source of truth. Docker Compose publishes it at
  `localhost:5433`; the backend runs locally at `localhost:8000`.
- This is an internal challenge/demo application, not a public multi-tenant
  service.

## Work-item model
| Field | Meaning |
|---|---|
| id | UUID generated for the work item |
| team_id | Team responsible for the work |
| title | Short description, required, up to 300 characters |
| description | Optional supporting context |
| next_action | Required concrete next step; defaults to "Needs triage" |
| type | `incident`, `customer_issue`, `payment`, `compliance`, or `task` |
| state | `open`, `in_progress`, `pending_approval`, `resolved`, or `closed` |
| priority | `low`, `medium`, `high`, or `urgent` |
| owner_id | Optional user currently responsible for the item |
| created_by_id | User who created the item |
| requires_approval | Whether the item requires approval |
| version | Positive integer for detecting stale updates |
| due_at | Optional timestamp |
| created_at, updated_at | Server timestamps |

## Implemented API
- `GET /health`: database connectivity check.
- `POST /auth/login`: authenticate with email and password; returns a bearer
  access token.
- `GET /auth/me`: return the authenticated user's profile and team memberships.
- Missing or invalid authentication returns 401. Team access dependencies
  return 404 when the user is not a member and 403 when the user's role is
  insufficient.

## Planned work
- Transactional work-item transitions that record an audit event and an outbox
  event together.
- Atomic claiming and version-checked updates that reject stale versions.
- Idempotent writes, comments, event history, team-scoped lists and search,
  dashboards, and an outbox worker.
- Frontend work-item list and detail views, including conflict handling for
  optimistic claims.

## Security and known limitations
- Access tokens expire after 60 minutes; refresh tokens, logout revocation, and
  login rate limiting are not implemented.
- The frontend stores its bearer token in localStorage, which is exposed to
  same-origin script execution.
- Seed users share a demo password. The seed command is for local/demo use and
  must not be run in production.
