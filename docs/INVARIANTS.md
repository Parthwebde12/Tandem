# Invariants

1. An item has at most one owner at any time.
2. If N users claim the same unowned item at once, exactly one succeeds; the rest get 409.
3. A write using a stale `version` never overwrites newer data (409 instead).
4. Every state/owner/priority change creates exactly one `item_event` in the SAME transaction.
5. `item_events` rows are never updated or deleted.
6. Only transitions listed in SPEC section 4 can happen; anything else is 422.
7. A user can only read or modify items in teams where they have a membership; role limits actions.
8. The approver of a `pending_approval` item is never its owner.
9. Repeating a request with the same Idempotency-Key produces exactly one effect and returns the same response.
10. An outbox event may be processed more than once, but its side effect happens once (idempotent handler).
11. List endpoints never return unbounded results; pagination is cursor-based.