# Learning log

Format: `DD-MM-YYYY | Decision or lesson | Why it matters (the failure it prevents)`

- 16-10-2026 | One DB session per request via get_db dependency | Avoids sharing sessions across concurrent requests.
- 16-10-2026 | Unique (user_id, key) on idempotency_keys | Two simultaneous requests with the same key cannot both run the action (invariant 9).
- 16-10-2026 | Vite proxy /api to the backend | The browser talks to one origin, so no CORS setup is needed in development.
- 17-10-2026 | Removed the no-login task board and returned to the spec | The brief requires teams, roles and server-side authz; a CRUD board cannot show concurrency or audit correctness.
- 17-10-2026 | Frontend loads the user from /auth/me and treats a 401 as "logged out" (clears the token) | The UI never trusts a stale token or stored role; the server is the authority.
- 17-10-2026 | Token kept in localStorage | Simple and survives refresh, but readable by any XSS; listed in known limitations (httpOnly cookie is the safer alternative).
- 17-10-2026 | Team permission dependencies hide non-member teams with 404 and centralize role checks | Prevents cross-team access and inconsistent authorization rules across endpoints.
- 17-10-2026 | Workspace overview renders only memberships returned by /auth/me | Keeps the frontend useful before work-item APIs exist without inventing dashboard data.
- 17-10-2026 | A 401 from /auth/me clears both the stored token and active auth state | Prevents focus-triggered refetches from repeatedly sending a token the server rejected.
- 18-10-2026 | Claim is one conditional UPDATE, not read-then-write | Two users cannot both win; Postgres row lock serialises them and the loser matches 0 rows.
- 18-10-2026 | version in the WHERE clause of every update, 409 returns the current item | A stale edit can never overwrite newer data, and the client can reconcile without another request.
- 18-10-2026 | Idempotency key is inserted in the same transaction as the action | "Action happened" and "key stored" cannot disagree, even if the server crashes between them.
- 18-10-2026 | 404 for both missing item and non-member | An outsider cannot learn that an item exists.
- 18-10-2026 | Outbox row written with the change; worker uses SKIP LOCKED and a unique (event, user) notification key | Notifications are never lost, and a retried event never notifies twice.
- 18-10-2026 | Tests run on a separate Postgres database | Row locks, unique-index waits and triggers do not exist in SQLite, so the concurrency tests would prove nothing there.
- 18-10-2026 | Dashboard, searchable work-item filters and detail activity/comments use typed API responses and shared query caching | Keeps views synchronized with server data and prevents UI-only or cross-team assumptions.