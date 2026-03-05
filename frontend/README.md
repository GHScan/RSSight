# Frontend

## Scope

- React + TypeScript + Vite.
- Tailwind CSS for styling; design tokens and conventions are documented in `docs/frontend-styling.md` (from repo root).
- React Router: home, feed management (`/feeds`), article list (`/feeds/:feedId/articles`), article summary (`/feeds/:feedId/articles/:articleId`), summary profiles (`/profiles`).
- API client layer (`src/api/`) separate from UI for testability; calls backend `/api/feeds`, `/api/summary-profiles`, and article/summary endpoints.
- Empty, loading, and error states on data pages.
- Vitest + Testing Library for smoke, routing, and page-state tests.

## Run locally (Windows cmd)

```bat
npm install
npm run dev
```

## Tests and quality checks

```bat
npm run test -- --run
npm run test:e2e
npm run lint
npm run typecheck
```

Visual regression (S018) is part of `test:e2e`. To update screenshot baselines after intentional UI changes: `npx playwright test e2e/visual-regression.spec.ts --update-snapshots`. See `docs/testing-strategy.md` (from repo root).
