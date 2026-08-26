#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/.logs"
BACKEND_PORT="${BACKEND_PORT:-9201}"
FRONTEND_PORT="${FRONTEND_PORT:-9200}"

mkdir -p "$LOG_DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Stopping local services..."
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT SIGINT SIGTERM

cd "$PROJECT_DIR"
[[ -f .env ]] || { echo ".env missing"; exit 1; }

check_port_free() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use:"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN
    exit 1
  fi
}

check_port_free "$BACKEND_PORT"
check_port_free "$FRONTEND_PORT"

"$SCRIPT_DIR/local-db-check.sh"

BACKEND_PORT="$BACKEND_PORT" "$SCRIPT_DIR/local-backend.sh" > "$LOG_DIR/backend-local.log" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 40); do
  if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1 || curl -sf "http://localhost:${BACKEND_PORT}/docs" >/dev/null 2>&1; then
    echo "Backend is ready"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend failed to start. Check $LOG_DIR/backend-local.log"
    exit 1
  fi
  sleep 1
done

VITE_API_URL="http://localhost:${BACKEND_PORT}" "$SCRIPT_DIR/local-frontend.sh" > "$LOG_DIR/frontend-local.log" 2>&1 &
FRONTEND_PID=$!

for _ in $(seq 1 40); do
  if curl -sf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    echo "Frontend is ready"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "Frontend failed to start. Check $LOG_DIR/frontend-local.log"
    exit 1
  fi
  sleep 1
done

echo
echo "All local services running"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Backend:  http://localhost:${BACKEND_PORT}"
echo "Docs:     http://localhost:${BACKEND_PORT}/docs"
echo "Logs:     $LOG_DIR"
echo
echo "Press Ctrl+C to stop"

wait "$BACKEND_PID" "$FRONTEND_PID"