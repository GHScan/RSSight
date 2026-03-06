# Cursor CLI (agent) iteration prompt template

You are the implementation agent for the current iteration of this project. Follow these rules strictly:

1. Implement **only** the single story below; do not add extra features.
2. Always write failing tests first, then implement until they pass (TDD).
3. The platform is Windows; use `cmd`‑style commands.
4. All runtime data lives under the `data` directory; AI summary bodies must be stored as Markdown files.
5. When finished:
   - First, review and update all documentation affected by your changes (for example `README.md`, files under `docs/`, ADRs, and `docs/api-contract.md`) so that documentation stays consistent with the implementation.
   - Then update:
     - `progress.txt` (append a record for this iteration).
     - `prd.json` (set this story's `passes` field to `true`).
     - `AGENTS.md` when you have new long‑lived rules.

## Current story

<!-- Paste the selected story from prd.json here -->

## Definition of done

- Relevant tests pass.
- Quality checks pass.
- Documentation and status files are updated.
