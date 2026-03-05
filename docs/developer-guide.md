# Developer guide

This page contains development-focused information that used to be in the root `README.md`.
If you are only using the service, start from the root `README.md` instead.

Normative engineering rules are centralized in `AGENTS.md`.
This page is intentionally lightweight and focuses on developer entry commands and links.

## First read

1. `AGENTS.md`
2. `docs/architecture.md`
3. `docs/testing-strategy.md`
4. `docs/ralph-workflow.md`

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

Both backend (port 8000) and frontend (port 5173) must be running. The frontend proxies `/api` to the backend; if you see "后端未启动或无法连接", start the backend or run `scripts\start.cmd` from the repo root.

To get tracebacks in API error responses (500), set `WEBRSS_DEBUG=1` in the environment before starting the backend (e.g. in the backend console: `set WEBRSS_DEBUG=1` then run uvicorn, or use `scripts\start.cmd` after adding it to the backend start command).

## Local quality gate

```bat
scripts\ci-check.cmd
```

## Main document entrypoints

- Rules and policy: `AGENTS.md`
- Documentation index: `docs/README.md`
- API contract: `docs/api-contract.md`
- ADRs: `docs/adr/`
