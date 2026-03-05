# API contract draft (MVP)

This document defines the REST API direction that later implementations should follow, so that backend and frontend can develop in parallel against a shared contract.

At the current stage of the project, the backend implements the **Health**, **Feeds**, **Summary Profiles**, and **Summaries** sections below. The **Articles** section is a forward‑looking contract (see `prd.json`).

## Health

- `GET /healthz`
  - `200`: `{ "status": "ok" }`

## Feeds

- `GET /api/feeds`
- `POST /api/feeds`
- `PUT /api/feeds/{feedId}`
- `DELETE /api/feeds/{feedId}`

## Articles

- `GET /api/feeds/{feedId}/articles`
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
