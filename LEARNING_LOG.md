# Learning log

Format: `DD-MM-YYYY | Decision or lesson | Why it matters (the failure it prevents)`

- 16-10-2026 | One DB session per request via get_db dependency | Avoids sharing sessions across concurrent requests.
- 16-10-2026 | Unique (user_id, key) on idempotency_keys | Two simultaneous requests with the same key cannot both run the action (invariant 9).
- 16-10-2026 | Vite proxy /api to the backend | The browser talks to one origin, so no CORS setup is needed in development.