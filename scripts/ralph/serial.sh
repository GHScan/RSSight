#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

ITERATION=0
PROMPT="Complete one story from prd.json and commit"

# Default Ralph agent command for Unix:
#   codebuddy --model glm-5.0-ioa --dangerously-skip-permissions
export RALPH_AGENT_EXEC="${RALPH_AGENT_EXEC:-codebuddy}"
if [ -z "${RALPH_AGENT_FLAGS+x}" ]; then
  export RALPH_AGENT_FLAGS="--model glm-5.0-ioa --dangerously-skip-permissions"
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[serial] python3/python not found in PATH"
  exit 127
fi

while true; do
  if ! grep -Eq '"passes":[[:space:]]*false' prd.json 2>/dev/null; then
    echo "[serial] all stories pass; done."
    exit 0
  fi

  ITERATION=$((ITERATION + 1))
  echo "[serial] iteration $ITERATION"

  if "$PYTHON_BIN" "$SCRIPT_DIR/cursorcli-progress.py" "$PROMPT"; then
    continue
  else
    AGENT_EXIT=$?
    echo "[serial] agent exited with code $AGENT_EXIT"
    exit "$AGENT_EXIT"
  fi
done
