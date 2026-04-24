#!/bin/bash
# One-click dependency setup for backend + frontend. Run from anywhere; script resolves repo root from its own path.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "Setting up RSSight dependencies..."
echo ""

echo "[1/2] Backend setup"
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
    echo "[INFO] Creating backend virtual environment (.venv)"
    python3 -m venv .venv
fi

echo "[INFO] Installing backend dependencies (editable + dev extras)"
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .[dev]

echo ""
echo "[2/2] Frontend setup"
cd "$ROOT/frontend"
echo "[INFO] Installing frontend dependencies from lock file (including devDependencies)"
npm ci --include=dev

echo ""
echo "Setup complete."
echo "Next step:"
echo "  ./scripts/start.sh"
