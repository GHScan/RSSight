# Ralph workflow

This project does not depend on upstream `ralph.sh`.
It follows Ralph iterations using local templates and checklists.

Normative rules (TDD, concurrency policy, done criteria, update policy) are defined in `AGENTS.md`.
This document focuses only on Ralph execution mechanics.

## Artifacts used by the flow

- Task source: `prd.json`.
- Rules source: `AGENTS.md`.
- Parent scheduling policy: `scripts/ralph/schedule.md`.
- Iteration template/checklist: files under `scripts/ralph/`.
- Story status and lessons: `prd.json`, `progress.txt`.

## Serial Ralph loop (Cursor CLI)

For a simple serial run without wave scheduling, use the Cursor CLI (command name: `agent`). From the repo root:

```cmd
scripts\ralph\serial.cmd
```

This script loops while `prd.json` has any story with `passes=false`, and each time runs:

```text
agent -p --force "完成一个 prd.json 的 story 并提交"
```

Ensure `agent` (Cursor CLI) is on your PATH. The loop stops when every story passes or when an agent run exits non-zero.

## Parent wave flow

1. Read `scripts/ralph/schedule.md` and build wave graph from `prd.json`.
2. Detach parent workspace: run `git checkout --detach base_branch` so the parent no longer has `base_branch` checked out (see schedule.md “Local-only branch model” for full semantics). The parent must not commit or merge in this workspace during waves.
3. For each wave, launch up to configured parallel subagents (max 8).
4. Wait for all subagents in current wave to complete.
5. If current wave contains failures, stop scheduling subsequent waves and report.
6. If wave succeeds, continue to next wave until completion.
7. After wave scheduling ends, checkout `base_branch` again in parent workspace.
8. Run final integration gate on `base_branch` (`scripts\ci-check.cmd`) before declaring overall success.
9. If final integration gate fails, report `integration_gate_failed` and append one follow-up fix story in `prd.json`.

## Subagent single-story flow

1. Subagent receives one `prd_id`, `branch_name`, `worktree_name`, and `base_branch`.
2. Branch/worktree naming is allocated only by parent scheduler (`scripts/ralph/schedule.md`), subagent uses them as-is.
3. Execute only that story under strict TDD and local checks.
4. Perform merge flow (`base -> branch`, then checkout `base` in sandbox, then `branch -> base`) with conflict-resolution retries.
5. On merge success, subagent cleans up completed feature branch/worktree and reports structured result.

## Suggested Cursor CLI (agent) prompt structure

The prompt should include:

- The full content of the current story.
- The iteration boundary (only this story).
- A reminder to follow all mandatory rules in `AGENTS.md`.

You can reuse the template in `scripts/ralph/prompt-agent.md`.

## Handling failures

- If a story cannot be stabilized, keep `passes=false`, record the blocker, and split follow-up work into `prd.json`.

## Iteration health checklist

- Did the iteration follow `AGENTS.md` mandatory rules?
- Did it update only the selected story scope?
- Are outputs traceable via template/checklist artifacts?
