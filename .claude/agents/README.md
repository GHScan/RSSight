# Agents

Parent scheduling strategy: `scripts/ralph/schedule.md`

## `ralph` subagent

Location: `.claude/agents/ralph.md`

Purpose: implement exactly one PRD story in its own isolated git worktree sandbox.

### Invocation template

```text
agent: ralph
prd_id: S008
branch_name: ralph/S008-complete-feed-management-interaction
worktree_name: ralph__S008-complete-feed-management-interaction
base_branch: feature/ai-rss-reader
```
