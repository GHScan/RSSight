# Testing strategy

Mandatory TDD policy and per-story coverage requirements are defined in `AGENTS.md`.
This document covers practical scope and command references.

## Testing levels

- **Backend unit tests:** service logic, file-storage logic, template rendering.
- **Backend API tests:** route I/O, error codes, contract stability.
- **Frontend component/page tests:** interactions, state transitions, error display, visible UI text.
- **Smoke tests:** `/healthz` and basic frontend rendering.

## Commands (Windows)

- Backend:
  - `python -m pytest -q`
  - `python -m ruff check app tests`
  - `python -m black --check app tests`
  - `python -m mypy app`
- Frontend:
  - `npm run test -- --run` — unit tests
  - `npm run test:ui` — component/page tests under `src/__tests__`
  - `npm run test:e2e` — Playwright E2E (headless)
  - `npm run lint`
  - `npm run typecheck`

## UI automation (E2E)

- **Scope:** feed management, article list, article summary, summary profile management, custom article creation, article favorites, read-later flows. E2E tests mock the API; no backend required.
- **Prerequisites:** Node.js 20+, frontend deps installed. First-time: `npx playwright install chromium` in `frontend/`.
- **Commands:** `cd frontend && npm run test:e2e` (headless) or `npm run test:e2e:headed` (visible browser).
- **Base URL:** Default `http://127.0.0.1:5173`. Override with `PLAYWRIGHT_BASE_URL`.

## Visual regression

- **Scope:** Critical pages and key UI states with screenshot baselines (desktop 1280x720 and narrow 375x667).
- **Location:** `frontend/e2e/visual-regression.spec.ts`; baselines in `frontend/e2e/visual-regression.spec.ts-snapshots/`.
- **Updating baselines:** `cd frontend && npx playwright test e2e/visual-regression.spec.ts --update-snapshots`. Review diffs before committing updated PNGs.

## Fast full-project gate

- `scripts\ci-check.cmd`
