# API contract draft (MVP)

This document defines the REST API direction that later implementations should follow, so that backend and frontend can develop in parallel against a shared contract.

At the current stage of the project, the backend implements the **Health**, **Feeds**, and **Summary Profiles** sections below. The **Articles** and **Summaries** sections are forward‑looking contract definitions that will be implemented in later stories (see `prd.json`).

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
- `PUT /api/summary-profiles/{profileName}`
- `DELETE /api/summary-profiles/{profileName}`

## Summaries

- `GET /api/feeds/{feedId}/articles/{articleId}/summaries/{profileName}`
- `POST /api/feeds/{feedId}/articles/{articleId}/summaries/{profileName}:generate`

## Constraints

- Summary bodies are both returned and stored primarily as Markdown.
- Deleting or editing a profile triggers a global cleanup of summaries with the same profile name.
- Error responses should include machine‑readable fields: `code`, `message`, and `details` (to be refined in later iterations).
