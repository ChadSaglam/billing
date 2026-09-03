#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# dev.sh — start the full stack
#
#   ./scripts/dev.sh            # auto: docker if available, else local
#   ./scripts/dev.sh docker     # postgres + backend in docker, vite on host
#   ./scripts/dev.sh local      # postgres on host, uvicorn in venv, vite on host
#
# Ports, DB name and URLs all come from .env — nothing is hardcoded.
# ─────────────────────────────────────────────────────────
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_env
init_config

MODE="${1:-auto}"
if [[ "$MODE" == "auto" ]]; then
  if have docker && docker info >/dev/null 2>&1; then MODE="docker"; else MODE="local"; fi
fi
[[ "$MODE" =~ ^(docker|local)$ ]] || die "Unknown mode '$MODE' — use: docker | local"

BACKEND_PID=""; FRONTEND_PID=""

cleanup() {
  echo ""
  log_info "Shutting down..."
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null
  done
  [[ "$MODE" == "docker" ]] && $COMPOSE down
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo -e "${BOLD}🧾 ${APP_NAME} — dev (${MODE})${RESET}"
echo ""

require_port_free "$FRONTEND_PORT" "frontend" || exit 1

# ── Backend + database ─────────────────────────────────
if [[ "$MODE" == "docker" ]]; then
  log_info "Starting database..."
  $COMPOSE up -d db >>"$LOG_DIR/docker.log" 2>&1 || die "docker compose up db failed"
  check_docker_db || exit 1

  log_info "Starting backend on :${BACKEND_PORT}..."
  $COMPOSE up -d backend >>"$LOG_DIR/docker.log" 2>&1 || die "docker compose up backend failed"
  wait_for_http "${BACKEND_URL}/api/health" "Backend" 40 || {
    log_error "See: docker compose logs backend"; exit 1; }
else
  check_local_db || exit 1
  require_port_free "$BACKEND_PORT" "backend" || exit 1

  log_info "Starting backend on :${BACKEND_PORT}..."
  (
    activate_venv
    export PYTHONPATH="$BACKEND_DIR"
    cd "$BACKEND_DIR"
    exec uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
  ) >"$LOG_DIR/backend-local.log" 2>&1 &
  BACKEND_PID=$!
  wait_for_http "${BACKEND_URL}/api/health" "Backend" 40 "$BACKEND_PID" || {
    log_error "See $LOG_DIR/backend-local.log"; exit 1; }
fi

# ── Frontend ───────────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  log_warn "node_modules missing — installing"
  (cd "$FRONTEND_DIR" && npm install) >>"$LOG_DIR/npm-install.log" 2>&1 || die "npm install failed"
fi

log_info "Starting frontend on :${FRONTEND_PORT}..."
(
  cd "$FRONTEND_DIR"
  VITE_API_URL="$BACKEND_URL" exec npx vite --host 0.0.0.0 --port "$FRONTEND_PORT"
) >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
wait_for_http "$FRONTEND_URL_LOCAL" "Frontend" 30 "$FRONTEND_PID" || {
  log_error "See $LOG_DIR/frontend.log"; exit 1; }

echo ""
echo -e "${GREEN}${BOLD}Running (${MODE})${RESET}"
echo "  Frontend  ${FRONTEND_URL_LOCAL}"
echo "  Backend   ${BACKEND_URL}"
echo "  API docs  ${BACKEND_URL}/docs"
echo "  Database  ${DB_NAME} @ $(db_url_field host):$( [[ "$MODE" == "docker" ]] && echo "$DB_PORT" || db_url_field port )"
echo "  Logs      ${LOG_DIR}/"
echo ""
echo -e "${DIM}Ctrl+C to stop${RESET}"

wait "$FRONTEND_PID"
