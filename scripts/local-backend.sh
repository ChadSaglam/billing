#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
BACKEND_PORT="${BACKEND_PORT:-9201}"

cd "$PROJECT_DIR"
[[ -f .env ]] || { echo ".env missing"; exit 1; }
[[ -d "$BACKEND_DIR/venv" ]] || { echo "backend/venv missing. Run ./scripts/local-setup.sh first."; exit 1; }

source "$BACKEND_DIR/venv/bin/activate"
export PYTHONPATH="$BACKEND_DIR"

exec uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT"