# AGENTS

This document defines the multi‑agent collaboration rules for the WebRSSReader project.  
All future agents **must** follow these rules.

## Global principles

- **Platform**: Development and deployment both target Windows; commands should use Windows `cmd` (`.cmd` / `.bat`) by default.
- **Scripting**: Use **Python** for scripts (automation, tooling, one-off tasks). Do **not** use PowerShell for script logic; prefer `.py` plus invocation from `.cmd` / `.bat` if needed.
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

- **progress.txt**: Records only **lessons learned** that affect subsequent development (append when such a lesson arises). Do **not** use it as an iteration log; iteration history lives in version control — use `git log` to inspect what was done per story/commit.
- Only long‑lived, cross‑iteration rules should be recorded in this file (`AGENTS.md`); temporary issues and one-off lessons belong in `progress.txt`.
- Never update `progress.txt` or set any story's `passes` field in `prd.json` to `true` until all relevant tests and quality checks for that story have passed. This explicitly includes frontend UI component/page tests when the story changes the user interface.
- Before marking any story as complete, review and update all documentation affected by the changes (for example `README.md`, files under `docs/`, ADRs, and `docs/api-contract.md`) so that documentation stays consistent with the source code.
- Before starting an iteration, always read:
  - `docs/architecture.md`
  - `docs/testing-strategy.md`
  - `docs/ralph-workflow-windows.md`

### Post-iteration: lessons and escalation to AGENTS.md

- **When completing an iteration**: Identify attempts that failed **two or more times** during this iteration, determine the **root cause** for each recurring failure, and append each as a lesson to `progress.txt` under "Lessons learned". This keeps a record of what went wrong and why.
- **Escalation**: When appending a lesson, check how many times the **same or equivalent** lesson already appears in `progress.txt`. If this append brings the total count to **three or more** (including this one), also add a **concrete avoidance rule** to `AGENTS.md` (for example under "Prohibited practices" or a new "Avoidance rules" subsection). The rule must be specific enough that a future agent can avoid the same mistake, reducing token use and development time.

## Language conventions

- **Code and implementation**: Source code (backend and frontend), identifiers, comments, log messages, and error messages should be written in **English**.
- **Project documentation**: Repository documentation (including `README.md`, files under `docs/`, ADRs, and backend/frontend READMEs, and `progress.txt`) should be written in **English**.
- **User interface**: Text visible to end users in the frontend UI (page titles, buttons, labels, prompts, error messages presented in the browser) should be written in **Simplified Chinese**.

## Prohibited practices

- Do **not** implement features without tests by skipping the “Red” phase (failing tests first).
- Do **not** work on multiple stories in a single iteration.
- Do **not** declare an iteration complete without updating documentation; append to `progress.txt` only when the iteration yields a lesson worth recording for future work.
- Do **not** change cross‑story state (`progress.txt`, story `passes` flags in `prd.json`) while tests are failing or have not been run.
