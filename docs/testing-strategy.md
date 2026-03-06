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

- **Scope:** Feed management flow (add/delete, validation and API-failure feedback, route and list regression). Split feed domains (S039): RSS and favorites rendered in separate lists, favorites top-level entry visible and usable, regression for RSS management with split UI. Article list flow (load, refresh, empty state, fetch failure and retry, reverse-chronological order, feed-to-list navigation). Article summary flow (profile select, trigger generation, no-data and failure feedback, re-entry). Summary profile flow (create, validation, conflict/API failure, list and nav). Custom article flow (S035): create virtual feed, open virtual feed article list, URL-branch create with success/failure feedback, no-URL two-step (first-click default fill, second-click confirm), validation feedback, and regression for normal RSS feed list. E2E tests mock the API; no backend is required.
- **Prerequisites:** Node.js 20+, frontend deps installed (`npm install` in `frontend/`). First-time: `npx playwright install chromium` in `frontend/`.
- **Commands (from repo root or frontend):**
  - `cd frontend && npm run test:e2e` — run E2E (headless). Playwright starts the dev server automatically.
  - `cd frontend && npm run test:e2e:headed` — run with visible browser.
- **Base URL:** Default `http://127.0.0.1:5173`. Override with `PLAYWRIGHT_BASE_URL` when the app is already running elsewhere.

## Visual regression (S018)

- **Scope:** Critical pages and key UI states have screenshot baselines: home, feed management (empty, list, error), summary profiles (empty); desktop (1280×720) and narrow viewport (375×667).
- **Location:** `frontend/e2e/visual-regression.spec.ts`; baselines in `frontend/e2e/visual-regression.spec.ts-snapshots/`.
- **Command (Windows):** `cd frontend && npm run test:e2e` (visual tests run with the rest of E2E; included in `scripts\ci-check.cmd`).
- **Updating baselines:** Run `cd frontend && npx playwright test e2e/visual-regression.spec.ts --update-snapshots` only when you intentionally change layout or styling. Review the diff (e.g. `test-results/` or Git) before committing; do not accept unexpected UI drift. Commit updated PNGs under `e2e/visual-regression.spec.ts-snapshots/` so CI stays green.

## Fast full-project gate

- Preferred full check from repository root:
  - `scripts\ci-check.cmd`
