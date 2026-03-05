# Ralph workflow

This project does not depend on upstream `ralph.sh`.
It follows Ralph iterations using local templates and checklists.

Normative rules (TDD, one-story-per-iteration, done criteria, update policy) are defined in `AGENTS.md`.
This document focuses only on Ralph execution mechanics.

## Artifacts used by the flow

- Task source: `prd.json`.
- Rules source: `AGENTS.md`.
- Iteration template/checklist: files under `scripts/ralph/`.
- Story status and lessons: `prd.json`, `progress.txt`.

## Per‑iteration flow

1. Open `prd.json` and pick the highest‑priority story with `passes=false`.
2. Read required context documents listed in `AGENTS.md`.
3. Execute the story using the templates in `scripts/ralph/`.
4. Run local checks (`scripts\ci-check.cmd`) and iterate until green.
5. Update outputs required by `AGENTS.md` (docs, lessons if any, story status) in the required order.
6. Repeat for the next story.

## Suggested OpenCode prompt structure

The prompt should include:

- The full content of the current story.
- The iteration boundary (only this story).
- A reminder to follow all mandatory rules in `AGENTS.md`.

You can reuse the template in `scripts/ralph/prompt-opencode.md`.

## Handling failures

- If a story cannot be stabilized, keep `passes=false`, record the blocker, and split follow-up work into `prd.json`.

## Iteration health checklist

- Did the iteration follow `AGENTS.md` mandatory rules?
- Did it update only the selected story scope?
- Are outputs traceable via template/checklist artifacts?
