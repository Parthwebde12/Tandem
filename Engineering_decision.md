# Engineering decisions

Tandem is a work-item tracker for teams (incidents, customer issues, payments,
compliance, tasks). This document explains the decisions that matter most, what
each one costs, and what is not built. Rules that must never break are in
docs/INVARIANTS.md.

## 1. Races are decided by the database, not by the application
**Decision.** Claiming is one conditional statement:
`UPDATE ... SET owner = me WHERE id = ? AND state = 'open' AND owner_id IS NULL`.
Postgres locks the row, so a second claimer waits, re-checks the condition and
matches zero rows. Every other change (edit, release, assign, transition) sends the
`version` it saw, and the UPDATE only matches that version.
**Why.** A read-then-write in Python has a gap in which two users both see "open".
A single statement has no gap. A 409 carries the current item, so the UI can show
who won without another request.
**Trade-off.** Users can see a 409 and must retry. I chose this over holding locks
across requests (they block other users and leak when a browser closes) and over
silently merging edits (that hides who changed what).
**Proof.** `test_ten_concurrent_claims_exactly_one_wins`,
`test_stale_edit_is_rejected_and_never_overwrites`.

## 2. Idempotency keys are stored in the same transaction as the action
**Decision.** Write endpoints accept an `Idempotency-Key` header. The key row is
inserted in the same transaction as the change and committed with it. A duplicate
that arrives while the first is still running waits on the unique index, then gets
the stored response (`Idempotent-Replay: true`). The same key with a different body
is rejected with 422. The frontend creates one key per user action and retries
network failures with the same key.
**Why.** "Action happened" and "key saved" can never disagree, even if the server
crashes in between. Double clicks and lost responses cannot create duplicates.
**Trade-off.** Failed requests are not stored (retrying a failure runs it again),
and old keys are never deleted, so a real deployment needs a cleanup job. I used a
table instead of Redis to avoid another service and to get transactional behaviour.
**Proof.** `test_same_idempotency_key_creates_one_item`,
`test_concurrent_requests_with_same_key_create_one_item`.

## 3. Audit history and side effects use a transactional outbox
**Decision.** Each change writes its `item_event` (append-only, enforced by a
database trigger) and an `outbox_event` in the same transaction as the change.
A separate worker (`python -m app.worker`) turns outbox events into notifications.
It takes rows with `FOR UPDATE SKIP LOCKED`, retries failures with exponential
backoff up to 5 attempts, and stores the error on the row. Notifications have a
unique (event, user) key, so processing an event twice notifies once.
**Why.** Sending after commit can lose a notification if the process dies in
between. Sending before commit can announce something that was rolled back. The
outbox avoids both, and a user's request never waits for or fails because of
notifications.
**Trade-off.** Delivery is at-least-once and delayed by the polling interval
(2 seconds). There is no message broker and no dead-letter screen; events that hit
the retry limit stay in the table for inspection.
**Proof.** `test_outbox_is_written_with_the_change_and_processed_once`,
`test_failed_outbox_event_is_retried_later_not_lost`.

## 4. Authorization is enforced on the resource, on the server
**Decision.** One dependency loads an item together with the caller's membership in
the item's team. An unknown item and a non-member both return 404, so outsiders
cannot learn that an item exists. Roles (viewer, member, manager, admin) are per
team, so one user can be a manager in one team and a member in another. Workflow
rules add separation of duties: the approver of an item cannot be its owner or its
creator. List queries filter by the caller's teams in SQL.
**Why.** Hiding buttons is not security, and checking in one place avoids endpoints
that forget to check.
**Trade-off.** Returning 404 instead of 403 makes debugging a little harder. A team
with a single manager cannot approve that manager's own items without an admin.
**Proof.** `test_non_member_gets_404_everywhere`, `test_roles_limit_actions`,
`test_creator_manager_cannot_approve_own_item`.

## 5. Reads stay cheap as data grows
**Decision.** Lists use keyset (cursor) pagination on `(created_at, id)` with a page
limit of 100, never offsets. Search uses PostgreSQL full-text search with a GIN
index. The dashboard is a few SQL aggregates plus top-10 queries backed by partial
indexes (overdue, urgent, unowned). The browser polls instead of using websockets.
**Why.** Offsets get slower with depth and skip or repeat rows when data changes
during paging. The dashboard never loads the dataset into memory.
**Trade-off.** No "jump to page 40" and no total count on lists. Search is stemmed
English matching, not fuzzy. Polling means changes can appear late (notifications
refresh every 30 seconds).
**Proof.** `test_keyset_pagination_returns_every_item_once`, `test_limit_is_capped`.

## Testing approach
Tests run against a real PostgreSQL database (`opsdesk_test`, created automatically)
because row locks, unique-index waits and triggers do not exist in SQLite. They cover
the behaviours that would be most dangerous if wrong: double claims, stale
overwrites, duplicate creation, cross-team access, workflow and approval rules,
audit immutability, pagination, and the worker's retry and duplicate handling.

## Known limitations
- No team or member management screens; members come from the seed script.
- A manager who created an item cannot approve it (separation of duties), so a team
  with one manager needs an admin to approve.
- Notifications are stored in the app, not emailed. The browser polls instead of
  using websockets, so changes can appear late.
- Failed idempotent requests are not stored, and old idempotency keys are never
  cleaned up.
- Items cannot move between teams, and `closed` is terminal.
- No login rate limiting, refresh tokens or token revocation; the token is kept in
  browser storage.
- Demo accounts and the one-click demo login are for local review only.