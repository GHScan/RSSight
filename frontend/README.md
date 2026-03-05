# Frontend

## Scope

- React + TypeScript + Vite.
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
npm run lint
npm run typecheck
```
