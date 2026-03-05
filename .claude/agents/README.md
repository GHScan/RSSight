# Agents

Parent scheduling strategy: `scripts/ralph/schedule.md`

## `ralph` subagent

Location: `.agents/agents/ralph.md`

Purpose: implement exactly one PRD story in its own isolated git worktree sandbox.

### Parent-agent invocation template

```text
agent: ralph
prd_id: S008
branch_name: ralph/S008-complete-feed-management-interaction
worktree_name: ralph__S008-complete-feed-management-interaction
base_branch: feature/ai-rss-reader
```

### Parallel invocation guidance

- Use wave-based scheduling from `scripts/ralph/schedule.md`.
- Run one `ralph` subagent per `prd_id` in a wave.
- Parent agent must assign unique `branch_name` per subagent.
- Maximum concurrent subagents per wave is `8`.
- Parent agent handles timeout stop/cleanup; subagent handles merge conflicts, re-check, merge success cleanup.
