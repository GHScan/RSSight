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

## Local quality gate

```bat
scripts\ci-check.cmd
```

## Main document entrypoints

- Rules and policy: `AGENTS.md`
- Documentation index: `docs/README.md`
- API contract: `docs/api-contract.md`
- ADRs: `docs/adr/`
