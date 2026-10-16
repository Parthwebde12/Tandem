# OpsDesk: Specification (DRAFT v1)


## 1. Purpose
OpsDesk is an internal web app where teams create, assign, track and resolve
operational work items (incidents, customer issues, payment investigations,
approvals). It gives one reliable place for: what the work is, who owns it,
what changed, and what needs attention next.

## 2. Users, teams, roles
- A user can belong to many teams; they have ONE role per team.
- Roles (per team): `viewer`, `member`, `manager`, `admin`.
- All authorization is checked on the server, per team and per item.
- A user with no membership in an item's team cannot see that item at all (404, not 403, to avoid leaking existence).

## 3. Work item
| Field | Notes |
|---|---|
| id | UUID |
| team_id | exactly one team per item (assumption A1) |
| title, description | required title |
| type | `incident`, `customer_issue`, `payment`, `compliance`, `task` |
| state | see section 4 |
| priority | `low`, `medium`, `high`, `urgent` |
| owner_id | nullable (unclaimed) |
| created_by | user id |
| requires_approval | bool, set at creation |
| version | integer, +1 on every change (optimistic locking) |
| due_at | optional; used for "overdue" attention |
| created_at, updated_at | timestamps |

## 4. Workflow (state machine)
States: `open`, `in_progress`, `pending_approval`, `resolved`, `closed`.

| From | To | Who | Rule |
|---|---|---|---|
| open | in_progress | member+ | via claim (self) or assign (manager+) |
| in_progress | open | owner or manager+ | release; clears owner |
| in_progress | pending_approval | owner | only if requires_approval = true |
| in_progress | resolved | owner | only if requires_approval = false |
| pending_approval | resolved | manager+ | approver must NOT be the owner |
| pending_approval | in_progress | manager+ | reject; comment required |
| resolved | closed | manager+ | |
| resolved | in_progress | member+ | reopen; comment required |
| closed | (none) | | terminal |

Anything not listed is rejected with 422.

## 5. Permissions
| Action | viewer | member | manager | admin |
|---|---|---|---|---|
| View team items and history | yes | yes | yes | yes |
| Create item | no | yes | yes | yes |
| Comment | no | yes | yes | yes |
| Claim unowned item | no | yes | yes | yes |
| Edit title/description | no | owner | yes | yes |
| Change priority | no | owner | yes | yes |
| Assign/reassign others | no | no | yes | yes |
| Approve / reject | no | no | yes | yes |
| Close | no | no | yes | yes |
| Manage team members | no | no | no | yes |

## 6. Collaboration and history
- Comments on items (append-only; no edit/delete in v1).
- Every important change writes an `item_event` row: created, claimed, released,
  assigned, priority_changed, state_changed, edited, commented.
- Events store actor, old value, new value, timestamp. Events are never updated or deleted.

## 7. Dashboard and search
- "Needs my attention": items I own that are overdue or urgent; items awaiting
  my approval (if manager+); unowned urgent items in my teams.
- Filters: team, state, priority, owner, type, overdue.
- Full-text search on title + description (Postgres tsvector + GIN).
- Keyset (cursor) pagination, never offset. Default page size 25.

## 8. Concurrency cases handled
1. Two users claim the same item: atomic conditional UPDATE; one wins, other gets 409.
2. Stale edit: client sends `version`; mismatch returns 409 with current item.
3. Duplicate request (retry/double-click): `Idempotency-Key` header, same key returns stored response.
4. Invalid transition: central transition function; 422.
5. Async notifications: transactional outbox + worker, retries, idempotent handler.

## 9. Assumptions
- A1: An item belongs to exactly one team (moving teams is out of scope).
- A2: Auth is email + password with seeded demo users; no signup, no SSO.
- A3: Notifications are simulated (logged / stored), not real email.
- A4: Clients get freshness via polling (e.g. every 15s), not websockets.
- A5: Comments cannot be edited or deleted (keeps history trustworthy).

## 10. Decisions
- Approver may not be the item's owner or creator (separation of duties).
- `closed` is terminal in v1; reopening is only possible from `resolved`. (Limitation: no admin override.)
- Unclaimed urgent items notify managers/admins of the owning team, because they can assign it; the dashboard still shows it to everyone in the team.
- `requires_approval` can be changed after creation by manager/admin only, never while the item is pending_approval, resolved or closed; every change is audited.