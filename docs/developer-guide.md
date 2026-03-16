# Developer guide

Practical guide for setting up, running, and testing RSSight locally.
For engineering rules and agent policy, see `AGENTS.md`.

## Local setup (Windows cmd)

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e .[dev]

cd ..\frontend
npm install
```

## Local run

```bat
scripts\start.cmd
```

Both backend (port 8000) and frontend (port 5173) must be running. The frontend proxies `/api` to the backend.

## Debugging

To get tracebacks in API error responses (500), set `WEBRSS_DEBUG=1` before starting the backend.

## Local quality gate

```bat
scripts\ci-check.cmd
```

## Key documents

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Engineering rules and policy |
| `docs/architecture.md` | System design and file layout |
| `docs/testing-strategy.md` | Test scope and commands |
| `docs/api-contract.md` | Backend API contract |
| `docs/adr/` | Architecture Decision Records |
