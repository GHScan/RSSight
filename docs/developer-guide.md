# Developer guide

Practical guide for setting up, running, and testing RSSight locally.
For engineering rules and agent policy, see `AGENTS.md`.

## Local setup

### Windows (cmd)

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e .[dev]

cd ..\frontend
npm install
```

### macOS/Linux (bash)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]

cd ../frontend
npm install
```

## Local run

### Windows

```bat
scripts\start.cmd
```

### macOS/Linux

```bash
scripts/start.sh
```

Both backend (port 8173 default) and frontend (port 5173 default) must be running. The frontend proxies `/api` to the backend.

### Manual start (without scripts)

If you prefer to start backend and frontend manually in separate terminals:

**Windows (two separate terminals):**

Terminal 1 (backend):
```bat
cd backend
.venv\Scripts\activate.bat
set WEBRSS_DEBUG=1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8173
```

Terminal 2 (frontend):
```bat
cd frontend
set BACKEND_PORT=8173
set FRONTEND_PORT=5173
npm run dev -- --port 5173 --host
```

**macOS/Linux (two separate terminals):**

Terminal 1 (backend):
```bash
cd backend
source .venv/bin/activate
WEBRSS_DEBUG=1 uvicorn app.main:app --reload --host 0.0.0.0 --port 8173
```

Terminal 2 (frontend):
```bash
cd frontend
BACKEND_PORT=8173 FRONTEND_PORT=5173 npm run dev -- --port 5173 --host
```

## Debugging

To get tracebacks in API error responses (500), set `WEBRSS_DEBUG=1` before starting the backend.

## Local quality gate

### Windows

```bat
scripts\ci-check.cmd
```

### macOS/Linux

```bash
scripts/ci-check.sh
```

The quality gate runs:
- Backend: ruff (lint), black (format check), mypy (type check), pytest
- Frontend: lint, typecheck, test:ui (vitest), test:e2e (Playwright)

## Key documents

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Engineering rules and policy |
| `docs/architecture.md` | System design and file layout |
| `docs/testing-strategy.md` | Test scope and commands |
| `docs/api-contract.md` | Backend API contract |
| `docs/adr/` | Architecture Decision Records |
