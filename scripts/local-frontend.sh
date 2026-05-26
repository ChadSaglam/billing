#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_DIR/frontend"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

cd "$PROJECT_DIR"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

cd "$FRONTEND_DIR"

exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"