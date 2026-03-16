# Ralph Scheduling Strategy

Parent-agent scheduling strategy for parallel Ralph runs.
All safety and engineering rules are in `CLAUDE.md`; this file covers scheduling mechanics only.

## Local-only branch model

- No remote sync during wave execution; parent may optionally sync remote once before scheduling.
- **Parent detach (mandatory before launching subagents):** Run `git checkout --detach base_branch` in the parent workspace so `base_branch` ref is free for subagent merges. Parent must not commit or merge during waves.
- During execution, all subagents operate only on local branches.
- A subagent may fail to merge because another subagent merged first; this is expected.
- After all waves end, parent runs `git checkout base_branch` to restore the workspace.
- Parent may then decide whether to push remote.

## Inputs

- `base_branch` (default: current branch)
- `max_parallel_per_wave` (fixed: `8`)
- `subagent_timeout_minutes` (default: 45)
- Optional `target_prd_ids`; if absent, pick all stories with `passes=false`.

## Branch naming contract

Parent generates per wave item:

- `branch_name`: git branch identifier passed to subagent.
- `worktree_name`: filesystem-safe folder name passed to subagent.

Rules:

1. Pattern: `ralph/{prd_id}-{word1}-{word2}-{word3}` (first 3 alphanumeric words from story title, lowercased).
2. If fewer than 3 words, use all available; fallback slug is `story`.
3. Uniqueness: append `-2`, `-3`, ... if duplicate in run or branch already exists locally.

Parent is the single source of truth for naming. Subagent must not alter these values.

```python
import re

def build_branch_name(prd_id: str, title: str, used: set[str], exists_fn) -> str:
    words = re.findall(r"[A-Za-z0-9]+", title.lower())
    slug = "-".join(words[:3]) if words else "story"
    base = f"ralph/{prd_id}-{slug}"
    name = base
    index = 2
    while name in used or exists_fn(name):
        name = f"{base}-{index}"
        index += 1
    used.add(name)
    return name

def build_worktree_name(branch_name: str) -> str:
    key = branch_name.replace("/", "__").replace("\\", "__")
    key = re.sub(r"[^A-Za-z0-9._-]", "_", key)
    key = re.sub(r"_+", "_", key).strip("._ ")
    return key or "ralph_story"
```

## Dependency inference and wave graph

### Step 1: Build candidate set

1. Read `prd.json`; take stories where `passes=false`.
2. If `target_prd_ids` provided, intersect.

### Step 2: Infer dependencies

Infer directed edges `A -> B` (B depends on A) from title/description semantics:

- UI automation stories depend on their interaction/flow stories.
- Visual migration/verification stories depend on foundation/migration stories.
- "Refine/complete details" stories depend on foundational API/flow stories for that domain.
- When uncertain, serialize (conservative).

Keep inference dynamic from current `prd.json`; do not hardcode story IDs.

### Step 3: Topological wave generation

1. Topological sort on candidate graph.
2. Build waves by indegree-0 layers.
3. Split oversized layers into chunks <= `max_parallel_per_wave`.
4. Each wave item carries: `prd_id`, `branch_name`, `worktree_name`, `depends_on`.

## Launch contract

Parent passes to each subagent: `prd_id`, `branch_name`, `worktree_name`, `base_branch`.
Subagent creates worktree at `.worktrees/ralph/{worktree_name}`.

## Wave dispatch protocol

For each wave in order:

1. Launch all items concurrently (up to 8).
2. Monitor running subagents.
3. If every item succeeds, continue to next wave.
4. If any item fails/times out/needs handoff, mark wave failed and stop scheduling later waves.
5. Do not cancel other running subagents in the failed wave; wait for all to finish.

## Timeout and forced cleanup

Parent checks each subagent on interval (e.g. every 60s). If runtime exceeds `subagent_timeout_minutes`, mark `timed_out` and stop the subagent.

After stop/failure:

1. **Restore `base_branch` if left mid-merge/rebase.** In parent workspace: `git checkout base_branch`, then `git merge --abort` or `git rebase --abort` as needed. Do not reset to wave-start commit; other subagents may have merged successfully.
2. Remove worktree safely (`git worktree remove <path>`).
3. Delete associated branch if not merged.
4. Record cleanup result (`cleaned`, `partial`, `skipped`) with reason.

## Shared-file conflict policy

- `prd.json`: unique `prd_id` per subagent -> updates on different lines, merge directly.
- `progress.txt` / `AGENTS.md`: same-line conflicts -> resolve by coexistence (keep both sides).
- Other source files: resolved by subagents during their merge flow.

After all waves:

1. Parent runs a non-concurrent reconciliation pass on `progress.txt` and `AGENTS.md`.
2. If coexistence merge introduces logical contradiction, parent resolves or reports error.

## Final integration gate

Before declaring success, parent must run a full integration gate on `base_branch`:

1. Ensure parent workspace is on `base_branch`.
2. Run `scripts\ci-check.cmd` against the fully merged state.
3. If gate fails: set run outcome to failed; keep per-story marks as-is; append a new `prd.json` fix item (`passes=false`, next priority, clear title/description of the failure, acceptance criteria including reproducer + fix + green ci-check).
4. Only when this gate passes is the run successful.

## Result report format

Trigger report when all waves finish, scheduling stops on failure, or integration gate fails.

### Per-wave block

```text
wave: <index>
status: success | failed | partial
items:
  - prd_id: <id>
    branch: <name>
    status: success | failed | timed_out | needs_handoff | already_done
    worktree: <path-or-none>
    commit: <hash-or-none>
    checks: pass|fail|unknown
```

### Final summary block

```text
overall_status: all_waves_success | stopped_on_failed_wave | integration_gate_failed
planned_waves: <n>
completed_waves: <n>
failed_wave: <index-or-none>
integration_gate:
  status: pass | fail | not_run
  failing_command: <text-or-none>
  created_followup_prd_id: <id-or-none>
story_counts:
  total: <n>
  success: <n>
  failed: <n>
  timed_out: <n>
  needs_handoff: <n>
  already_done: <n>
next_action:
  - <concise operator suggestion>
```
