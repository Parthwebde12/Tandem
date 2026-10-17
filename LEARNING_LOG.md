# Learning log

Format: `DD-MM-YYYY | Decision or lesson | Why it matters (the failure it prevents)`

- 16-10-2026 | One DB session per request via get_db dependency | Avoids sharing sessions across concurrent requests.
- 16-10-2026 | Unique (user_id, key) on idempotency_keys | Two simultaneous requests with the same key cannot both run the action (invariant 9).
- 16-10-2026 | Vite proxy /api to the backend | The browser talks to one origin, so no CORS setup is needed in development.
- 17-10-2026 | Removed the no-login task board and returned to the spec | The brief requires teams, roles and server-side authz; a CRUD board cannot show concurrency or audit correctness.
- 17-10-2026 | Frontend loads the user from /auth/me and treats a 401 as "logged out" (clears the token) | The UI never trusts a stale token or stored role; the server is the authority.
- 17-10-2026 | Token kept in localStorage | Simple and survives refresh, but readable by any XSS; listed in known limitations (httpOnly cookie is the safer alternative).