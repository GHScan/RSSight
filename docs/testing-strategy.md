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
  - `npm run test:ui` — component/page tests under `src/__tests__`
  - `npm run test:e2e` — Playwright E2E (feed management and other flows)
  - `npm run lint`
  - `npm run typecheck`

## UI automation (E2E, Windows)

- **Scope:** Feed management flow (add/edit/delete/refresh, validation and API-failure feedback, route and list regression). Article list flow (load, refresh, empty state, fetch failure and retry, reverse-chronological order, feed-to-list navigation). E2E tests mock the API; no backend is required.
- **Prerequisites:** Node.js 20+, frontend deps installed (`npm install` in `frontend/`). First-time: `npx playwright install chromium` in `frontend/`.
- **Commands (from repo root or frontend):**
  - `cd frontend && npm run test:e2e` — run E2E (headless). Playwright starts the dev server automatically.
  - `cd frontend && npm run test:e2e:headed` — run with visible browser.
- **Base URL:** Default `http://localhost:5173`. Override with `PLAYWRIGHT_BASE_URL` when the app is already running elsewhere.

## Fast full-project gate

- Preferred full check from repository root:
  - `scripts\ci-check.cmd`
