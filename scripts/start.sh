#!/bin/bash
# One-click start of backend + frontend. Run from anywhere; script resolves repo root from its own path.
# Usage: start.sh [backend_port] [frontend_port]   (defaults: 8173 5173)

set -e

# Resolve repo root from script location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Port arguments with defaults
BACKEND_PORT="${1:-8173}"
FRONTEND_PORT="${2:-5173}"

echo "Starting RSSight backend and frontend (bound to all interfaces, LAN accessible)..."
echo "Backend:  http://0.0.0.0:$BACKEND_PORT  (e.g. http://YOUR_IP:$BACKEND_PORT)"
echo "Frontend: http://0.0.0.0:$FRONTEND_PORT (e.g. http://YOUR_IP:$FRONTEND_PORT)"
echo ""
echo "Press Ctrl+C in each terminal or close terminals to stop the services."
echo ""

# Function to start backend
start_backend() {
    if [ -d "$ROOT/backend/.venv/bin" ]; then
        echo "[INFO] Using backend/.venv"
        cd "$ROOT/backend"
        source .venv/bin/activate
        WEBRSS_DEBUG=1 uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
    else
        echo "[INFO] No backend/.venv found; using current Python. To use a venv: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e .[dev]"
        cd "$ROOT/backend"
        WEBRSS_DEBUG=1 python -m uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
    fi
}

# Function to start frontend
start_frontend() {
    cd "$ROOT/frontend"
    BACKEND_PORT="$BACKEND_PORT" FRONTEND_PORT="$FRONTEND_PORT" npm run dev -- --port "$FRONTEND_PORT" --host
}

# Check if running in an interactive terminal that supports background jobs
if [ -t 0 ]; then
    # Interactive mode: start both in background and bring to foreground
    echo "Starting backend in background..."
    start_backend &
    BACKEND_PID=$!

    echo "Starting frontend in background..."
    start_frontend &
    FRONTEND_PID=$!

    echo ""
    echo "Both processes started. Open http://127.0.0.1:$FRONTEND_PORT (or http://YOUR_IP:$FRONTEND_PORT from other devices) in your browser."
    echo ""
    echo "Backend PID: $BACKEND_PID"
    echo "Frontend PID: $FRONTEND_PID"
    echo ""
    echo "Press Ctrl+C to stop both services..."

    # Trap Ctrl+C to kill both processes
    trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

    # Wait for both processes
    wait
else
    # Non-interactive mode: print instructions for manual start
    echo "Non-interactive terminal detected."
    echo ""
    echo "To start manually, open two terminals and run:"
    echo ""
    echo "  Terminal 1 (backend):"
    echo "    cd $ROOT/backend"
    if [ -d "$ROOT/backend/.venv/bin" ]; then
        echo "    source .venv/bin/activate"
    fi
    echo "    WEBRSS_DEBUG=1 uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT"
    echo ""
    echo "  Terminal 2 (frontend):"
    echo "    cd $ROOT/frontend"
    echo "    BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT npm run dev -- --port $FRONTEND_PORT --host"
    exit 0
fi
