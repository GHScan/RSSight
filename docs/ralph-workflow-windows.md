# Ralph workflow (Windows + OpenCode)

This project does not depend on the upstream `ralph.sh`.  
Instead, we follow the Ralph method and run iterations on Windows using documented flows, checklists, and templates.

## Per‑iteration flow

1. Open `prd.json` and pick the highest‑priority story with `passes=false`.
2. Read `AGENTS.md`, `docs/architecture.md`, and `docs/testing-strategy.md`.
3. Implement the selected story in OpenCode, following strict TDD.
4. Run local quality checks (see `scripts/ci-check.cmd`) and ensure they are fully green. If any check fails, fix tests/code and rerun until all pass before proceeding.
5. **Only after step 4 is fully green**, review and update all documentation affected by the changes, then update records:
   - Review and update all impacted docs (for example `README.md`, files under `docs/`, ADRs, and `docs/api-contract.md`) so they stay consistent with the implementation.
   - Append this iteration’s conclusion to `progress.txt`.
   - Update `AGENTS.md` (long‑lived rules only).
   - Mark the story’s `passes` field to `true` in `prd.json`.
6. Move to the next story and repeat until all pass.

## Suggested OpenCode prompt structure

The prompt should include:

- The full content of the current story.
- The iteration boundary (only this story).
- A reminder to write failing tests first.
- A reminder to update `progress.txt` and `prd.json` **only after all relevant tests and quality checks have passed**.

You can reuse the template in `scripts/ralph/prompt-opencode.md`.

## Handling failures

- If tests cannot be made stable:
  - Keep the story’s `passes` field as `false`.
  - Record the blocking reason in `progress.txt`.
  - Split sub‑problems and add them into `prd.json`.

## Iteration health checklist

- Did this iteration only change one story?
- Are there appropriate tests for the changes?
- Was the progress record updated?
- Did the iteration avoid polluting unrelated modules?
