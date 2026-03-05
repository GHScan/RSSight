# Ralph workflow overview

This project uses the Ralph method for multi‑session continuous development.  
The concrete Windows execution details are documented in `docs/ralph-workflow-windows.md`.

## Core artifacts

- Task source: `prd.json`.
- Iteration history: `progress.txt`.
- Team rules: `AGENTS.md`.
- Per‑iteration goal: complete exactly one story.

## Iteration outputs

- Code changes.
- Test changes.
- Documentation updates.
- `prd.json` status progression (`passes=false` -> `passes=true`).

## Success criteria

- All stories have `passes=true`.
- All tests and quality checks pass.
