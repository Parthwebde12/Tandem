# Invariants

1. An item has at most one owner at any time.
2. If N users claim the same unowned item at once, exactly one succeeds; the rest get 409.
3. A write using a stale `version` never overwrites newer data (409 with the current item instead).
4. Every state/owner/priority change creates its `item_event` (and outbox event) in the SAME transaction.
5. `item_events` rows are never updated or deleted (database trigger).
6. Only transitions listed in docs/workflow.md can happen; anything else is 422.
7. A user can only read or modify items in teams where they have a membership (404 otherwise); role limits actions (403).
8. The approver of a `pending_approval` item is never its owner or creator.
9. Repeating a request with the same Idempotency-Key produces exactly one effect and returns the same response.
10. An outbox event may be processed more than once, but its side effect happens once (unique key on notifications).
11. List endpoints never return unbounded results; pagination is cursor-based (max 100).