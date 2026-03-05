# Ralph execution checklist

## Mode selection (must choose one)

- [ ] Parent scheduler mode (wave orchestration across multiple subagents).
- [ ] Subagent mode (single-story implementation only).
- [ ] Confirm exactly one mode is selected for this run.

## Parent scheduler mode

### Before scheduling

- [ ] Read `scripts/ralph/schedule.md` and `AGENTS.md`.
- [ ] Load `prd.json` and collect candidate stories with `passes=false`.
- [ ] Infer dependencies and generate waves.
- [ ] Allocate `prd_id`, `branch_name`, and legal `worktree_name` for each wave item.
- [ ] Confirm wave concurrency limit (`max_parallel_per_wave<=8`).
- [ ] Detach parent workspace: run `git checkout --detach base_branch` (see schedule.md “Local-only branch model”).

### During scheduling

- [ ] Launch subagents for the current wave only.
- [ ] Monitor status/timeout for each running subagent.
- [ ] If one subagent fails in a wave, mark wave failed and stop creating new waves.
- [ ] Wait for all subagents in the current wave to finish naturally.
- [ ] Trigger cleanup for timed-out/failed runs: restore `base_branch` if needed (`git checkout base_branch`, then `git merge --abort` or `git rebase --abort` per schedule.md), then remove worktree and delete branch.

### After scheduling

- [ ] Produce per-wave and final summary report.
- [ ] Verify cleanup status for failed/timed-out runs is recorded.
- [ ] Checkout `base_branch` again in parent workspace.
- [ ] Re-check only `progress.txt` and `AGENTS.md` consistency after coexistence merge.
- [ ] Confirm no out-of-scope story was scheduled.

## Subagent mode

### Before the iteration

- [ ] Select one story with `passes=false`.
- [ ] Read `AGENTS.md`.
- [ ] Read relevant architecture/testing docs.
- [ ] Clarify that out‑of‑scope work is not allowed this round.

### During the iteration

- [ ] Write failing tests first.
- [ ] Implement the minimal code to make tests pass.
- [ ] Add boundary and regression tests.
- [ ] Keep changes focused on this story only.

### After the iteration

- [ ] Run `scripts/ci-check.cmd` (this must include passing frontend UI component/page tests).
- [ ] Review and update all documentation affected by the changes (for example `README.md`, files under `docs/`, ADRs, and `docs/api-contract.md`) before marking the story as complete.
- [ ] Append to `progress.txt` only when there is a cross-iteration lesson likely to recur (especially after repeated failed attempts).
- [ ] Update `AGENTS.md` if there are new long‑lived rules.
- [ ] Mark this story’s `passes` as `true` in `prd.json`.
