# Testing strategy (TDD first)

## Core principles

- Write failing tests first (Red).
- Implement the minimum code to make tests pass (Green).
- Refactor while keeping all tests passing (Refactor).

## Testing levels

- Backend unit tests: service logic, file‑storage logic, template rendering logic.
- Backend API tests: route I/O, error codes, and contract stability.
- Frontend component/page tests: key interactions, state transitions, and error display.
- Smoke tests: `/healthz` and basic frontend rendering.

## Story‑level testing requirements

For each story in `prd.json`, at minimum:

- 1 failing test case for the new behavior (happy path).
- 1 boundary/exception test case.
- 1 regression test case to avoid breaking existing behavior.

## Commands (Windows)

- Backend:
  - `python -m pytest -q`
  - `python -m ruff check app tests`
  - `python -m black --check app tests`
  - `python -m mypy app`
- Frontend:
  - `npm run test -- --run`
  - `npm run lint`
  - `npm run typecheck`

## Acceptance gate

- All tests relevant to the current iteration must pass.
- Do not hide failures by skipping tests.
- When fixing a historical bug, add at least one regression test.

## Cross‑iteration state updates

- Cross‑iteration artifacts such as `prd.json` story `passes` flags and `progress.txt` iteration records must only be updated after the acceptance gate is satisfied.
- Never flip a story's `passes` field to `true` or record an iteration as "done" while tests are red or local quality checks are failing.
