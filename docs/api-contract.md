# API contract draft (MVP)

This document defines the REST API direction that later implementations should follow, so that backend and frontend can develop in parallel against a shared contract.

At the current stage of the project, the backend implements the **Health**, **Feeds**, **Summary Profiles**, and **Summaries** sections below. The **Articles** section is a forward‑looking contract (see `prd.json`).

## Health

- `GET /healthz`
  - `200`: `{ "status": "ok" }`

## Feeds

- `GET /api/feeds` — returns list of feeds; each item has `id`, `title`, `url` (null for virtual feeds), and `feed_type` (`"rss"` or `"virtual"`). Virtual feeds are collections (e.g. favorites) with no URL.
- `GET /api/feeds/{feedId}` — returns a single feed by id; 404 if not found.
- `POST /api/feeds` — create RSS feed (body: `title`, `url`).
- `POST /api/feeds/virtual` — create virtual feed (body: `name`). Persists with empty URL and `feed_type: "virtual"`. Deleting a virtual feed removes its directory subtree like RSS feeds.
- `PUT /api/feeds/{feedId}`
- `DELETE /api/feeds/{feedId}`

## Articles

- `GET /api/feeds/{feedId}/articles` — returns list with `id`, `title`, `link`, `published`, optional `title_trans`, `favorite`, `favorited_at`, and optional `source` (custom-article source metadata). Sort order: recently favorited first, then by published desc. Custom articles under virtual feeds use the same storage path and appear in this list.
- `POST /api/feeds/{feedId}/articles` — create a custom article under a virtual feed (body: `title`, `link` optional, `description` optional, `published_at` ISO or null, `source` optional). When `link` is provided and title/description/published_at are missing, the backend may fetch and parse the URL to autofill only empty fields (user-provided values are never overwritten). When `link` is not provided (no-URL path), `title` and `description` (content) are mandatory; 400 with `MISSING_REQUIRED_FIELDS` and `details.missing` (e.g. `["title"]`, `["description"]`) if either is missing; `published_at` defaults to current time when absent. Returns 201 with created article; 400 if feed is not virtual or if autofill fails (`AUTOFILL_FAILED`) or required fields remain missing (`MISSING_REQUIRED_FIELDS`); 404 if feed not found.
- `PUT /api/feeds/{feedId}/articles/{articleId}/favorite` — body `{ "favorite": true | false }`; sets/clears favorite marker file in article folder.
- `POST /api/feeds/{feedId}/refresh` (manually trigger a fetch)

## Summary Profiles

- `GET /api/summary-profiles`
- `POST /api/summary-profiles`
- `PUT /api/summary-profiles/{profileName}` — supports optional `name` in body for renaming; returns `409` if new name already exists. Delete and rename both trigger global cleanup of summary files for the affected profile name.
- `DELETE /api/summary-profiles/{profileName}`

## Summaries

- `GET /api/feeds/{feedId}/articles/{articleId}/summaries/{profileName}` — returns existing summary markdown or 404.
- `POST /api/feeds/{feedId}/articles/{articleId}/summaries/{profileName}/generate` — triggers AI summary generation; returns the summary body (201). Prompt template supports variables such as `{title}`, `{content}`, `{link}`.

## Constraints

- Summary bodies are both returned and stored primarily as Markdown.
- Deleting or editing a profile triggers a global cleanup of summaries with the same profile name.
- Error responses should include machine‑readable fields: `code`, `message`, and `details` (to be refined in later iterations).
