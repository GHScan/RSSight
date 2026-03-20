# AGENTS

Operational handbook for all coding agents working in RSSight.
All rules are mandatory unless explicitly overridden by the user.

**Precedence:** Direct user request > this file > other project docs.

## 1) Startup reads

Every iteration:
1. `CLAUDE.md` (this file)
2. `prd.json` — pick highest-priority story with `passes=false`

Parent scheduler additionally reads: `scripts/ralph/schedule.md`

Read other docs **only when relevant** to the current story:

| Topic | File |
|---|---|
| Architecture & file layout | `docs/architecture.md` |
| API contract | `docs/api-contract.md` |
| Testing commands | `docs/testing-strategy.md` |
| Frontend styling tokens | `docs/frontend-styling.md` |
| Deployment | `docs/deployment-windows.md` |
| Developer setup | `docs/developer-guide.md` |
| Iteration template | `scripts/ralph/iteration-template.md` |
| Story template | `docs/story-template.md` |

## 2) Repository map

- `backend/` — FastAPI routes, services, domain logic, scheduler.
- `frontend/` — React pages/components, API client layer (`src/api/`).
- `data/` — runtime data only (feeds, articles, summaries, metadata).
- `docs/` — architecture, contracts, ADRs.
- `scripts/` — startup and quality scripts (`start.cmd`, `start.sh`, `ci-check.cmd`, `ci-check.sh`).
- `prd.json` — story backlog and pass/fail status.
- `progress.txt` — cross-iteration lessons learned only.

## 3) Engineering rules

### Platform
- **Supported platforms:** Windows, macOS, Linux.
- **Script conventions:**
  - Windows: use `.cmd`/`.bat` scripts (e.g., `start.cmd`, `ci-check.cmd`).
  - macOS/Linux: use `.sh` bash scripts (e.g., `start.sh`, `ci-check.sh`).
  - **Rule:** When adding new scripts, create both `.cmd` and `.sh` versions.
- **Shell command differences:**
  - Windows `cmd`: chain with `&&`, use `%VAR%` for variables, `\` for paths.
  - Windows PowerShell: chain with `;` not `&&` (PowerShell issue).
  - Bash (macOS/Linux): chain with `&&`, use `$VAR` for variables, `/` for paths.
- Do not use PowerShell for script logic; use Python invoked from `cmd` wrappers.
- Verify cwd and shell type before running terminal commands.

### TDD and change granularity
- Strict TDD: **Red -> Green -> Refactor**. Never skip the Red phase.
- Each subagent iteration completes exactly one story. Never bundle multiple stories.
- Parent scheduler may run parallel waves per `scripts/ralph/schedule.md`.

### Definition of done
A story is done only when **all** are true:
1. Relevant tests and quality checks pass.
2. Impacted documentation is updated.
3. Story marked `passes=true` in `prd.json`.

## 4) Architecture and code constraints

### Data boundaries
- All runtime business data under `data/` only. Never modify files outside repo root.
- AI summaries stored as Markdown: `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`

### Deletion rules
- Deleting a feed -> delete full feed directory subtree.
- Deleting/renaming a summary profile -> delete all `.md` files and metadata for that profile across all feeds/articles.

### Backend
- Thin route handlers; business logic in service layer.
- External dependencies (RSS fetch, AI gateway, scheduler) must be mockable.
- File I/O: idempotent, failure-isolated; one feed failure must not break global tasks.

### Frontend
- Organize by user flow: feed management, article list, summary viewing/triggering, profile management.
- Keep API calling layer separate from UI components.

## 5) Testing and quality gates

- Minimum per story: 1 happy-path test (written failing first), 1 boundary/exception test, 1 regression test.
- Frontend behavior changes require UI component/page test updates.
- Never skip tests to bypass failures.
- Full local gate: `scripts/ci-check.cmd` (Windows) or `scripts/ci-check.sh` (macOS/Linux)

## 6) Documentation, status updates, and lessons

- Keep docs consistent with implementation before marking a story complete.
- Review impacted docs: `README.md`, `docs/`, ADRs, `docs/api-contract.md`.
- Never update `progress.txt` or set `passes=true` while tests are failing or unrun.
- Never declare completion without updating impacted documentation.
- `progress.txt` stores lessons learned only — not iteration logs. Only long-lived rules belong in this file.
- **Post-iteration:** identify failures that recurred >=2 times; record root cause in `progress.txt`. If the same lesson appears >=3 times in `progress.txt`, add a concrete avoidance rule here.

## 7) Language conventions

- **English:** code, identifiers, comments, logs, error messages, docs, commits.
- **Simplified Chinese:** user-facing frontend UI text.
