#!/bin/bash
# CI quality gate for Linux/macOS. Runs all backend and frontend checks.
# Usage: ci-check.sh   (run from repo root, or anywhere - script resolves path)

set -e

# Resolve repo root from script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Backend checks"
cd "$ROOT/backend"

python -m ruff check app tests

python -m black --check app tests

python -m mypy app

python -m pytest -q

cd "$ROOT"

echo "==> Frontend checks"
cd "$ROOT/frontend"

# Lint all frontend code (including components)
npm run lint

# Typecheck all frontend TypeScript
npm run typecheck

# Run UI component/page tests under src/__tests__
npm run test:ui

# Run Playwright E2E (feed management flow; API mocked, no backend required)
npm run test:e2e

cd "$ROOT"

echo "All baseline checks passed."
