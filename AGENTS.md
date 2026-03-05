# AGENTS

This document defines the multi‑agent collaboration rules for the WebRSSReader project.  
All future agents **must** follow these rules.

## Global principles

- **Platform**: Development and deployment both target Windows; commands should use Windows `cmd` (`.cmd` / `.bat`) by default.
- **Development mode**: Strict TDD (write failing tests first, then implement, then refactor).
- **Change granularity**: Each iteration must complete **exactly one** user story.
- **Definition of done**: All relevant tests pass **and** documentation is updated **and** the corresponding story in `prd.json` has `passes=true`.

## Code and directory constraints

- **Runtime data location**: All business runtime data must be written under the `data/` directory only.
- **AI summary body format**: Summary bodies must be stored as Markdown files; do not store them only in a database or only as JSON.
- **Recommended path for summaries**:
  - `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`
- **AI write boundary**: AI agents must never modify files outside the current project root directory.
- **Deletion rules**:
  - Deleting a feed => delete the entire feed directory subtree.
  - Deleting or editing a summary profile => delete all files and metadata with the same profile name under all feeds/articles.

## Backend constraints

- Use FastAPI routing plus a dedicated service layer; do not put core business logic directly into route functions.
- All external dependencies (RSS fetching, AI calls, schedulers) **must** be mockable for testing.
- File I/O must be idempotent and failure‑isolated so that a single feed failure does not affect global tasks.

## Frontend constraints

- Organize pages by user flows:
  - Feed management
  - Feed article list
  - Article summary viewing/triggering
  - Summary profile management
- Keep the API calling layer separate from UI components to simplify testing and swapping implementations.

## Documentation and workflow constraints

- Every iteration must append a new record to `progress.txt` (append‑only).
- Only long‑lived, cross‑iteration rules should be recorded in this file (`AGENTS.md`); temporary issues belong in `progress.txt`.
- Never update `progress.txt` or set any story's `passes` field in `prd.json` to `true` until all relevant tests and quality checks for that story have passed. This explicitly includes frontend UI component/page tests when the story changes the user interface.
- Before starting an iteration, always read:
  - `docs/architecture.md`
  - `docs/testing-strategy.md`
  - `docs/ralph-workflow-windows.md`

## Language conventions

- **Code and implementation**: Source code (backend and frontend), identifiers, comments, log messages, and error messages should be written in **English**.
- **Project documentation**: Repository documentation (including `README.md`, files under `docs/`, ADRs, and backend/frontend READMEs, and `progress.txt`) should be written in **English**.
- **User interface**: Text visible to end users in the frontend UI (page titles, buttons, labels, prompts, error messages presented in the browser) should be written in **Simplified Chinese**.

## Prohibited practices

- Do **not** implement features without tests by skipping the “Red” phase (failing tests first).
- Do **not** work on multiple stories in a single iteration.
- Do **not** declare an iteration complete without updating `progress.txt`.
- Do **not** change cross‑story state (`progress.txt`, story `passes` flags in `prd.json`) while tests are failing or have not been run.
