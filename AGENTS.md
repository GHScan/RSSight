# AGENTS

Operational handbook for all coding agents working in WebRSSReader.
All rules in this file are mandatory unless explicitly overridden by the user.

## 1) Source of truth and DRY

- Use this file as the primary rule and navigation entrypoint for agent work.
- If guidance is duplicated across documents, keep the authoritative version here and simplify references elsewhere.
- If instructions conflict, follow this precedence:
  1. Direct user request
  2. `AGENTS.md`
  3. Other project docs

## 2) Quick navigation

Read these files at the start of every iteration:

1. `AGENTS.md` (this file)
2. `docs/architecture.md`
3. `docs/testing-strategy.md`
4. `docs/ralph-workflow.md`
5. `prd.json` (pick highest-priority story with `passes=false`)

Helpful references by task:

- API contract: `docs/api-contract.md`
- Deployment: `docs/deployment-windows.md`
- User/developer entry docs: `README.md`, `docs/developer-guide.md`
- Iteration templates: `scripts/ralph/iteration-checklist.md`, `scripts/ralph/iteration-template.md`

## 3) Repository map (agent-focused)

- `backend/`: FastAPI routes, services, domain behavior, scheduler integration.
- `frontend/`: React pages/components and API client layer.
- `data/`: runtime data only (feeds, articles, summary markdown, metadata).
- `docs/`: architecture, contracts, workflow, ADRs.
- `scripts/`: local startup and quality scripts (`start.cmd`, `ci-check.cmd`).
- `prd.json`: story backlog and pass/fail status.
- `progress.txt`: cross-iteration lessons learned only.

## 4) Non-negotiable engineering rules

### Platform and scripting

- Development and deployment target Windows.
- Prefer Windows `cmd` (`.cmd` / `.bat`) commands.
- Do not use PowerShell for script logic; use Python scripts (`.py`) and invoke them from `cmd` wrappers when needed.
- Before running terminal commands, verify current cwd and shell type.
- In PowerShell, do not chain commands with `&&`; use `;` or run commands separately.

### TDD and change granularity

- Strict TDD: Red -> Green -> Refactor.
- Every iteration must complete exactly one story.

### Definition of done

A story is done only when all are true:

1. Relevant tests and quality checks pass.
2. Documentation impacted by the change is updated.
3. The story is marked `passes=true` in `prd.json`.

## 5) Architecture and code constraints

### Data and file boundaries

- All runtime business data must be stored under `data/` only.
- AI summary body must be stored as Markdown, not only database/JSON.
- Canonical summary path:
  - `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`
- Agents must never modify files outside the repository root.

### Domain deletion rules

- Deleting a feed must delete the full feed directory subtree.
- Deleting or renaming/editing a summary profile must delete all summary markdown files and related metadata with the same profile name across all feeds/articles.

### Backend design constraints

- Keep route handlers thin; put core business logic in dedicated service layer.
- External dependencies (RSS fetch, AI gateway, scheduler dependencies) must be mockable.
- File I/O must be idempotent and failure-isolated; one feed failure must not break global tasks.

### Frontend design constraints

- Organize UI by user flows:
  - feed management
  - feed article list
  - article summary viewing/triggering
  - summary profile management
- Keep API calling layer separate from UI components.

## 6) Testing and quality gates

- Minimum story-level test set:
  - 1 happy-path failing test first
  - 1 boundary/exception test
  - 1 regression test
- When frontend behavior changes, include/update UI component/page tests.
- Do not skip tests to bypass failures.
- Recommended full local gate:
  - `scripts\ci-check.cmd`

## 7) Documentation and status update policy

- Keep docs consistent with implementation before marking a story complete.
- Review and update impacted docs (for example: `README.md`, files under `docs/`, ADRs, `docs/api-contract.md`).
- `progress.txt` is not an iteration log; it stores lessons learned with cross-iteration value.
- Only long-lived rules belong in `AGENTS.md`; temporary details belong in `progress.txt`.
- Never update `progress.txt` or set story `passes=true` while tests/checks are failing or not run.

## 8) Post-iteration lessons and escalation

- At iteration end, identify attempts that failed two or more times.
- Record each recurring failure's root cause in `progress.txt` under lessons learned.
- If the same/equivalent lesson appears three or more times in `progress.txt` (including the new append), add a concrete avoidance rule to `AGENTS.md`.

## 9) Language conventions

- Code, identifiers, comments, logs, and error messages: English.
- Project documentation (`README.md`, `docs/`, ADRs, backend/frontend READMEs, `progress.txt`): English.
- User-facing frontend UI text: Simplified Chinese.

## 10) Prohibited practices

- Skipping the Red phase and implementing without failing tests first.
- Working on multiple stories in one iteration.
- Declaring completion without updating impacted documentation.
- Updating cross-story state (`progress.txt`, `prd.json` `passes`) before tests/checks are green.
