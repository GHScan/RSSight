# ADR-0002: Runtime data layout

## Status

Accepted

## Context

All runtime data must live under `data/`, and AI summary results must be stored as Markdown files that can be viewed directly.

## Decision

- Store summary bodies as `.md` files.
- Store structured information as `.json` files.
- Maintain a `summaries` subdirectory under each article.

## Recommended directory structure

```text
data/
├─ feeds.json
├─ summary_profiles.json
└─ feeds/
   └─ {feedId}/
      └─ articles/
         └─ {articleId}/
            ├─ article.json
            └─ summaries/
               ├─ {profileName}.md
               └─ {profileName}.meta.json
```

## Deletion and cascading rules

- Deleting a feed deletes the entire `feeds/{feedId}` directory.
- Deleting or editing a profile deletes all `{profileName}.md` and `{profileName}.meta.json` files.

## Consequences

- File‑system operations must consider concurrency and idempotency.
- Renaming a profile will trigger global cleanup and rebuild strategies (to be implemented in later iterations).
