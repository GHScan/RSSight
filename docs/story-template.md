# Story template (for `prd.json` entries)

## Template fields

- `id`: Unique identifier (for example, `S010`).
- `priority`: Number; smaller means higher priority.
- `title`: One‑sentence description of the outcome.
- `description`: Business goal plus technical boundaries.
- `acceptanceCriteria`: 3–5 verifiable criteria.
- `passes`: Initially `false`, set to `true` after the iteration is completed.

## Authoring rules

- Each iteration should focus on exactly one story.
- A story must be completable within a single context window/session.
- Every acceptance criterion must be testable.
- Avoid oversized stories like “implement the entire module”; they must be split into smaller pieces.
