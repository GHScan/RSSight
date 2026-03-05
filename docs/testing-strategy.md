# Testing strategy (TDD first)

Mandatory policy (TDD requirement, acceptance gate, and status update restrictions) is defined in `AGENTS.md`.
This document keeps only practical testing scope and command references.

## Testing levels

- Backend unit tests: service logic, file‑storage logic, template rendering logic.
- Backend API tests: route I/O, error codes, and contract stability.
- Frontend component/page tests: key interactions, state transitions, error display, and visible UI text.
- Smoke tests: `/healthz` and basic frontend rendering.

## Coverage checklist (practical)

For each story, include:

- behavior test for the main success path,
- boundary/exception behavior,
- regression coverage for previously working behavior.

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

## Fast full-project gate

- Preferred full check from repository root:
  - `scripts\ci-check.cmd`
