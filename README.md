# WebRSSReader

Foundation repository for a Windows‑oriented Web RSS Reader.  
The project provides the technology stack, Ralph/OpenCode workflow, and implements feed CRUD, RSS fetching with article persistence, and summary profile management. Further stories (AI summaries, scheduled fetch, frontend page flow) are in `prd.json`.

## Project goals (later iterations)

- Manage RSS feeds (create, read, update, delete).
- View articles for a single feed (sorted by time).
- Manually trigger a specific AI summary for an article and view the result.
- Manage multiple AI summary profiles (OpenAI‑compatible APIs).
- Persist AI summary results as Markdown files under `data/`, so external editors can read and edit them directly.

## Tech stack

- Backend: Python 3.12, FastAPI, Pydantic v2, pytest, ruff, black, mypy.
- Frontend: React, TypeScript, Vite, Vitest, Testing Library, ESLint, Prettier.
- Data: `data/` file storage (no database).
- Workflow: Ralph method + OpenCode (Windows‑oriented flow).

## Directory layout

```text
.
├─ backend/                 # Python backend foundation
├─ frontend/                # React frontend foundation
├─ data/                    # Runtime data directory (summary markdown lives here)
├─ docs/                    # Architecture / ADR / testing / workflow docs
├─ scripts/                 # CI and run scripts (e.g. ci-check.cmd, start.cmd)
├─ scripts/ralph/           # Ralph iteration templates and checklists (Windows)
├─ AGENTS.md                # Multi‑agent collaboration rules
├─ prd.json                 # Ralph user story pool
└─ progress.txt             # Iteration log (append‑only)
```

## Quick start (Windows cmd)

1. Install dependencies: Python 3.12+, Node.js 20+, and optionally `opencode` (CLI or Desktop).
2. Initialize backend: `cd backend`, `python -m venv .venv`, `.venv\Scripts\activate.bat`, `pip install -e .[dev]`.
3. Initialize frontend: `cd frontend`, `npm install`.
4. Start the app: from the repository root run `scripts\start.cmd` (optionally `scripts\start.cmd [backend_port] [frontend_port]`, defaults 8000 and 5173). Two console windows open; open <http://localhost:5173> in your browser (or the frontend port you passed). Close the two windows to stop the services.

For production deployment (reverse proxy, static assets, process supervision), see `docs/deployment-windows.md`.

## One‑command baseline check

From the repository root, run:

`scripts\ci-check.cmd`

This command will run:

- Backend: `ruff check`, `black --check`, `mypy`, `pytest`
- Frontend: `npm run lint`, `npm run typecheck`, `npm run test:ui` (component/page tests under `src/__tests__`)

## Ralph/OpenCode (Windows) entrypoint

1. Read `docs/ralph-workflow.md`.
2. Use `scripts/ralph/iteration-checklist.md` to execute a single iteration.
3. Use `scripts/ralph/iteration-template.md` to record each iteration.
4. After changes are made:
   - Update `progress.txt`.
   - Update `AGENTS.md` (only long‑lived rules).
   - Set the corresponding story’s `passes` field to `true` in `prd.json`.

## Architecture docs entrypoints

- `docs/README.md`
- `docs/architecture.md`
- `docs/api-contract.md`
- `docs/adr/0001-tech-stack.md`
- `docs/adr/0002-data-layout.md`

## Data persistence conventions (key)

- AI summary bodies are saved as Markdown:
  - `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`
- Article metadata and summary metadata are saved as JSON (in the same or parent directory).
- Deleting a feed deletes its entire directory.
- Deleting or editing a summary profile deletes all `.md` files and related metadata with the same profile name globally.

## Current status

- Feed CRUD API and file storage (S001), RSS fetching and article persistence (S002), summary profile management (S003), manual AI summary triggering (S004), and global profile cleanup (S005) are implemented and passing CI.
- Scheduled feed fetching (S006) is implemented: a background scheduler runs at a fixed interval and fetches all feeds; error isolation and logging are in place; manual and scheduled triggers coexist.
- Basic frontend page flow (S007) is implemented: React Router with home, feed management, article list, article summary, and summary profile pages; API client layer; empty/loading/error states; routing and key interactions covered by tests.
- All stories in `prd.json` are currently passing; new stories can be added there for future iterations.
