# WebRSSReader

Foundation repository for a Windows‑oriented Web RSS Reader.  
At this stage it only provides the technology stack, project skeleton, documentation system, and Ralph/OpenCode workflow, **without** business features implemented yet.

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
├─ scripts/ralph/           # Ralph iteration templates and checklists (Windows)
├─ AGENTS.md                # Multi‑agent collaboration rules
├─ prd.json                 # Ralph user story pool
└─ progress.txt             # Iteration log (append‑only)
```

## Quick start (Windows PowerShell)

1. Install dependencies:
   - Python 3.12+
   - Node.js 20+
   - `opencode` (CLI or Desktop)
2. Initialize backend environment (example):
   - `cd backend`
   - `python -m venv .venv`
   - `.venv\Scripts\Activate.ps1`
   - `pip install -e .[dev]`
3. Initialize frontend environment:
   - `cd frontend`
   - `npm install`

## One‑command baseline check

From the repository root, run:

`pwsh -ExecutionPolicy Bypass -File scripts/ci-check.ps1`

This command will run:

- Backend: `ruff check`, `black --check`, `mypy`, `pytest`
- Frontend: `npm run lint`, `npm run typecheck`, `npm run test`

## Ralph/OpenCode (Windows) entrypoint

1. Read `docs/ralph-workflow-windows.md`.
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

- The repository is in a “foundation ready, features to be implemented” state.
- Business stories are initialized in `prd.json` with `passes=false` and can be implemented by later agents one by one.
