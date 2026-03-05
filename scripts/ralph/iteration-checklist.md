# Single‑iteration checklist (Windows)

## Before the iteration

- [ ] Select one story with `passes=false`.
- [ ] Read `AGENTS.md`.
- [ ] Read relevant architecture/testing docs.
- [ ] Clarify that out‑of‑scope work is not allowed this round.

## During the iteration

- [ ] Write failing tests first.
- [ ] Implement the minimal code to make tests pass.
- [ ] Add boundary and regression tests.
- [ ] Keep changes focused on this story only.

## After the iteration

- [ ] Run `scripts/ci-check.cmd` (this must include passing frontend UI component/page tests).
- [ ] Append this iteration’s record to `progress.txt`.
- [ ] Update `AGENTS.md` if there are new long‑lived rules.
- [ ] Mark this story’s `passes` as `true` in `prd.json`.
