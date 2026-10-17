# MVP Invariants

1. Every task has a non-blank title and next action.
2. Task status and priority are limited to the values in `docs/SPEC.md`.
3. Updating or deleting an unknown task returns 404.
4. A list request returns no more than 100 tasks.
5. The local/demo API has no authentication; it must not be exposed to an
   untrusted network.
6. The new task-board migration does not drop or rewrite legacy OpsDesk tables.
