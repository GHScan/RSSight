# Windows deployment draft (MVP)

## Goals

- Run both backend and frontend reliably on Windows Server/Windows desktop.
- Ensure the `data/` directory is persistent and backup‑friendly.

## Recommended approach

- Backend: `uvicorn` behind a reverse proxy (IIS/NGINX on Windows).
- Frontend: Host static assets produced by `vite build` (IIS or any static server).
- Process supervision: Windows service (e.g., NSSM or Task Scheduler).

## Required configuration

- Pin Python/Node versions.
- Inject environment variables via system‑level configuration (do not commit them to the repo).
- Ensure clear read/write permissions for the `data/` directory.

## Pre‑run checklist

- `scripts/ci-check.cmd` passes completely.
- `GET /healthz` returns `ok`.
- Log directory is writable.
