# Backend Foundation

## Scope of this stage

- Minimal FastAPI application skeleton.
- `/healthz` smoke endpoint.
- Baseline configuration for pytest, ruff, black, and mypy.

## Run locally (Windows cmd)

```bat
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e .[dev]
uvicorn app.main:app --reload
```

## Tests and quality checks

```bat
python -m pytest -q
python -m ruff check app tests
python -m black --check app tests
python -m mypy app
```
