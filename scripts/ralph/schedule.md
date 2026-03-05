# Ralph Scheduling Strategy

This document defines the **single parent-agent** scheduling strategy for Ralph runs.

It is a process/playbook under `scripts/ralph/`, not a subagent definition.

## Scope split

Parent agent (single instance) owns:

- dependency inference from `prd.json`
- wave graph planning and wave-by-wave dispatch
- unique `branch_name` assignment
- legal `worktree_name` allocation
- subagent timeout control and forced stop
- cleanup of timed-out/failed run worktrees and branches
- final user-facing execution summary

Ralph subagent owns:

- single-story TDD implementation
- create worktree/branch from assigned `branch_name` and `worktree_name`
- conflict handling against local `base_branch`
- re-running checks after conflict resolution

Parent agent does **not** resolve code conflicts.

## Local-only branch model

- During parallel development, do not use remote synchronization logic.
- Before scheduling starts, parent agent may optionally sync remote once.
- **Parent detach (mandatory before launching subagents):** In the parent workspace run `git checkout --detach base_branch`. The parent workspace then points to the same commit as `base_branch` but is in detached HEAD state; the parent must not commit or merge in this workspace during waves. This leaves the branch ref `base_branch` free for subagents to update from their worktrees. Subagents checkout and merge into `base_branch` only inside their own worktrees.
- During wave execution, all subagents operate only on local branches.
- A subagent may fail to merge because another subagent merged earlier; this is the expected conflict source.
- After all waves end, parent agent runs `git checkout base_branch` again so the parent workspace is back on the branch.
- After all waves complete, parent agent may decide whether to sync/push remote.

## Inputs

- `base_branch` (default: current branch)
- `max_parallel_per_wave` (fixed: `8`)
- `subagent_timeout_minutes` (default: 45)
- optional fixed list `target_prd_ids`; if absent, pick from `passes=false`

## Branch naming contract (parent)

Parent only generates one name per wave item:

- `branch_name`: git branch identifier passed to subagent
- `worktree_name`: filesystem-safe worktree folder name passed to subagent

Rules:

1. `branch_name` pattern:
   - `ralph/{prd_id}-{title_word1}-{title_word2}-{title_word3}`
2. Word extraction:
   - use the story `title` from `prd.json`
   - split into alphanumeric words, keep the first 3 non-empty words
   - if fewer than 3 words exist, use all available words
3. Normalization for branch slug:
   - lowercase words
   - join with `-`
4. Uniqueness in one run:
   - if duplicate appears, append suffix `-n` (`-2`, `-3`, ...)
   - if local git branch already exists, keep incrementing suffix until available

Parent scheduler is the **single source of truth** for branch and worktree allocation.
Subagent must not generate or alter naming/path decisions.

Parent uses this deterministic function (no random path generation):

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

1. Read `prd.json`.
2. Take stories where `passes=false`.
3. If `target_prd_ids` exists, intersect with it.

### Step 2: Infer dependencies from content

Infer directed edges `A -> B` (B depends on A) by title/description semantics:

- If B is "Add UI automation for X flow", depend on story "Complete X interaction details".
- If B says "migrate visual design" or "verification after migration", depend on Tailwind foundation/migration stories.
- If B wording implies "refine/complete details", depend on foundational API/flow stories for that domain.
- If uncertain, prefer conservative dependency (serialize rather than parallelize).

Keep this inference dynamic from current `prd.json`; do not rely on hardcoded story IDs.

### Step 3: Generate waves by topological layering

1. Run topological sort on remaining nodes.
2. Build waves by indegree-0 layers.
3. Split oversized layer into chunks of size <= `max_parallel_per_wave` (8).
4. Each wave item carries:
   - `prd_id`
   - `branch_name` (unique, assigned by parent)
   - `worktree_name` (legal folder name, assigned by parent)
   - `depends_on`

## Launch contract

Parent passes to subagent:

- `prd_id`
- `branch_name`
- `worktree_name` (computed by `build_worktree_name`)
- `base_branch`

Subagent must use these values as-is and create worktree/branch in:

- `.worktrees/ralph/{worktree_name}`

## Wave dispatch protocol

For each wave in order:

1. Launch all wave items concurrently (up to 8).
2. Monitor running subagents.
3. If every item in wave succeeds, continue to next wave.
4. If any item fails/times out/needs handoff, mark this wave as failed and stop scheduling later waves.
5. Do not cancel other running subagents in this failed wave; wait for all of them to finish naturally.
6. Record wave-level status and exit reason.

## Timeout and forced cleanup

Parent checks each running subagent on interval (for example every 60s):

- if runtime > `subagent_timeout_minutes`: mark `timed_out`, stop the subagent.

After stop/failure:

1. **Restore `base_branch` if left mid-merge/mid-rebase.** A stopped subagent may have left `base_branch` in an incomplete merge or rebase (worktrees share refs). In the parent workspace run:
   - `git checkout base_branch`
   - If `git status` reports merge in progress: run `git merge --abort`
   - If `git status` reports rebase in progress: run `git rebase --abort`
   - This returns `base_branch` to the last consistent commit (e.g. before the failed subagent started its merge). Do not reset to a wave-start commit; other subagents in the same wave may already have merged successfully.
2. Use scheduled `worktree_name` to get deterministic `worktree_path`.
3. Remove worktree safely (`git worktree remove <path>` when possible).
4. Delete the associated branch if safe and not merged.
5. Record cleanup result (`cleaned`, `partial`, `skipped`) with reason.

Because only one parent scheduler exists, no extra cross-scheduler lock mechanism is required.

## Shared-file conflict policy

During parallel merges back to local `base_branch`:

- Parent scheduler guarantees each active subagent gets a different `prd_id`.
- `prd.json`: because `prd_id` is unique per subagent, updates are expected on different lines and should be merged directly.
- `progress.txt` and `AGENTS.md`: if same-line conflict appears, resolve by coexistence (keep both sides, preserving append intent).
- Other source files: conflicts are resolved by subagents during their merge flow.

After all waves finish (or stop):

1. Parent agent performs a non-concurrent reconciliation pass.
2. Re-check `progress.txt` and `AGENTS.md` for consistency/coherence only.
3. If coexistence merge in these two files introduces logical contradiction, parent resolves it in this phase; if unresolved, report error to user.
4. Parent does not run a second conflict-resolution pass for other source files.

## Final integration gate (mandatory)

Before declaring overall success, parent agent must run one full-project integration gate on local `base_branch`:

1. Ensure parent workspace is on `base_branch`.
2. Run `scripts\ci-check.cmd` once against the fully merged combined state.
3. If this gate fails:
   - set final run outcome to failed (even if all per-story subagent checks passed);
   - keep existing completed-story marks as-is (no rollback in this flow);
   - append one new `prd.json` item for fixing this integration failure;
   - report failing command summary and next-action handoff.
4. Only when this final gate passes can the run be reported as successful.

When appending the integration-fix item to `prd.json`:

- set `passes=false`
- place it at the next available priority
- title should clearly indicate integration gate failure fix scope
- description should include failing command summary and key error symptom
- acceptance criteria should include:
  - reproducible failing case
  - implemented fix with tests
  - `scripts\ci-check.cmd` passing on `base_branch`

## Result aggregation and user report

Trigger final report when:

- all waves finished successfully, or
- scheduling stopped due to first failed wave, or
- final integration gate failed after wave completion.

### Per-wave report block

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

## Safety constraints

- Never schedule two subagents for the same `prd_id` in one run.
- Never exceed `max_parallel_per_wave=8`.
- Never modify files outside repository root.
- Never use destructive git operations.
