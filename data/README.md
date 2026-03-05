# `data/` directory notes

`data/` is used **only** for runtime data and must not contain source code.

## Key conventions

- Feed index, article metadata, and profile configuration are stored as JSON.
- AI summary bodies must be stored as Markdown files so that external editors can view and edit them directly.
- Recommended path:
  - `data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md`

## Deletion rules

- Deleting a feed deletes its directory.
- Deleting or editing a summary profile deletes all summary markdown files and related metadata with the same name globally.
