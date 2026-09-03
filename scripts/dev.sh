#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# dev.sh — Start all services for local development
# billing: Invoicing & Document Management
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  docker compose down
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"

log_info()  { echo -e "${CYAN}$1${RESET}"; }
log_ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
log_warn()  { echo -e "  ${YELLOW}⊘${RESET} $1"; }
log_error() { echo -e "  ${RED}✗${RESET} $1"; }

echo -e "${BOLD}🧾 billing — Development Mode${RESET}"
echo ""

# ── Validate .env ──────────────────────────────────────
if [[ ! -f ".env" ]]; then
  log_error ".env file missing — copy .env.example and fill in values"
  exit 1
fi

# ── Check port conflicts ──────────────────────────────
for port in 5434 8001 5173; do
  if lsof -i :"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    log_warn "Port $port already in use"
    if [[ "$port" == "5173" ]]; then
      log_error "Frontend port $port occupied — free it before starting"
      exit 1
    fi
  fi
done

# ── Start Docker services ─────────────────────────────
log_info "Starting Docker services (db + backend)..."
docker compose up -d db 2>&1 | tee "$LOG_DIR/docker.log"
log_ok "Database starting"

log_info "Waiting for PostgreSQL..."
for i in {1..30}; do
  if docker compose exec -T db pg_isready -U chadev -d chadev_billing > /dev/null 2>&1; then
    log_ok "PostgreSQL ready (${i}s)"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    log_error "PostgreSQL not ready after 30s — check: docker compose logs db"
    exit 1
  fi
  sleep 1
done

# ── Backend ────────────────────────────────────────────
log_info "Starting backend (port 8001)..."
docker compose up -d backend 2>&1 | tee -a "$LOG_DIR/docker.log"

for i in {1..30}; do
  if curl -sf http://localhost:8001/docs > /dev/null 2>&1; then
    log_ok "Backend ready (${i}s)"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    log_error "Backend not ready after 30s — check: docker compose logs backend"
    exit 1
  fi
  sleep 1
done

# ── Frontend ───────────────────────────────────────────
log_info "Starting frontend (port 5173)..."
cd frontend

if [[ ! -d "node_modules" ]] || [[ ! -f "node_modules/.package-lock.json" ]]; then
  log_warn "node_modules missing, running npm install..."
  npm install 2>&1 | tee "$LOG_DIR/npm-install.log"
fi

npx vite --host > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  log_error "Frontend failed to start — check $LOG_DIR/frontend.log"
  exit 1
fi

cd "$PROJECT_DIR"

for i in {1..15}; do
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    log_ok "Frontend ready (${i}s)"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_error "Frontend process died — check $LOG_DIR/frontend.log"
    exit 1
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}${BOLD}All services running:${RESET}"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8001"
echo "  API Docs:  http://localhost:8001/docs"
echo "  Database:  PostgreSQL @ Docker (chadev_billing)"
echo "  Logs:      $LOG_DIR/"
echo ""
echo "Press Ctrl+C to stop all services."

wait "$FRONTEND_PID"