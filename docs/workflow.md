# Workflow, permissions and decisions

## States and transitions
| From | To | Action | Who | Rule |
|---|---|---|---|---|
| open | in_progress | claim | member+ | atomic; one winner |
| open / in_progress | in_progress | assign | manager+ | assignee must be member+ in the team |
| in_progress | open | release | owner or manager+ | clears owner |
| in_progress | pending_approval | submit_for_approval | owner | only if requires_approval |
| in_progress | resolved | resolve | owner | only if NOT requires_approval |
| pending_approval | resolved | approve | manager+ | approver is not owner/creator |
| pending_approval | in_progress | reject | manager+ | comment required; approver is not owner/creator |
| resolved | closed | close | manager+ | |
| resolved | in_progress | reopen | member+ | comment required |
| closed | none | | | terminal |

Not listed = 422. Allowed transition but wrong role = 403.

## Permissions
| Action | viewer | member | manager | admin |
|---|---|---|---|---|
| View team items, events, comments | yes | yes | yes | yes |
| Create item, comment, claim | no | yes | yes | yes |
| Edit title/description/next action/priority/due date | no | owner only | yes | yes |
| Assign / reassign | no | no | yes | yes |
| Approve / reject / close | no | no | yes | yes |
| Change requires_approval | no | no | yes | yes |

## Concurrency decisions
- Claim: one conditional UPDATE (`WHERE state='open' AND owner_id IS NULL`); Postgres row locking picks one winner, losers get 409 with the current item.
- Edits, release, assign, transition: client sends `version`; the UPDATE only matches `version = expected`, otherwise 409 with the current item.
- Idempotency-Key: the key row is inserted in the same transaction as the action; concurrent duplicates wait on the unique index, then replay the stored response. Failed attempts are not stored.
- Outbox: events are written in the same transaction as the change; a worker (`python -m app.worker`) processes them with `FOR UPDATE SKIP LOCKED`, retries with exponential backoff (max 5 attempts), and notifications have a unique (event, user) key so re-processing does nothing.