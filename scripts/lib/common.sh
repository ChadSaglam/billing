#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# common.sh — shared helpers. Source this, never run it.
#
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
#
# Provides: PROJECT_DIR, LOG_DIR, colours, log_*, ports and DB values
# read from .env, plus port/health helpers.
# ─────────────────────────────────────────────────────────

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(dirname "$LIB_DIR")"
PROJECT_DIR="$(dirname "$SCRIPTS_DIR")"
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

# ── Colours ────────────────────────────────────────────
if [[ -t 1 ]]; then
  CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
else
  CYAN=""; GREEN=""; YELLOW=""; RED=""; RESET=""; BOLD=""; DIM=""
fi

log_info()  { echo -e "${CYAN}$1${RESET}"; }
log_ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
log_warn()  { echo -e "  ${YELLOW}⊘${RESET} $1"; }
log_error() { echo -e "  ${RED}✗${RESET} $1"; }
die()       { log_error "$1"; exit 1; }
have()      { command -v "$1" >/dev/null 2>&1; }

# ── .env ───────────────────────────────────────────────
# Deliberately NOT `set -a`. Exporting .env strips the quotes from
# JSON-valued settings (ALLOWED_ORIGINS=["…"]) and pydantic-settings then
# fails to parse them in any child process.
load_env() {
  cd "$PROJECT_DIR"
  [[ -f .env ]] || die ".env missing — copy .env.example and fill it in"
  # shellcheck disable=SC1091
  source .env
}

# ── Derived config — one source of truth for every script ──────────────
init_config() {
  APP_NAME="${APP_NAME:-billing}"
  APP_ENV="${APP_ENV:-development}"
  BACKEND_PORT="${BACKEND_PORT:-8000}"
  FRONTEND_PORT="${FRONTEND_PORT:-5173}"
  DB_PORT="${DB_PORT:-5432}"
  DB_USER="${POSTGRES_USER:-postgres}"
  DB_NAME="${POSTGRES_DB:-postgres}"
  BACKEND_URL="http://localhost:${BACKEND_PORT}"
  FRONTEND_URL_LOCAL="http://localhost:${FRONTEND_PORT}"
  COMPOSE="docker compose"
  BACKEND_DIR="$PROJECT_DIR/backend"
  FRONTEND_DIR="$PROJECT_DIR/frontend"
  VENV_DIR="$BACKEND_DIR/venv"
}

# ── Ports ──────────────────────────────────────────────
port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

require_port_free() {
  local port="$1" label="$2"
  if port_in_use "$port"; then
    log_error "Port $port ($label) is already in use:"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN | tail -n +2 | sed 's/^/      /'
    return 1
  fi
  return 0
}

# ── Waiting ────────────────────────────────────────────
# wait_for_http <url> <label> [timeout_seconds] [pid_to_watch]
wait_for_http() {
  local url="$1" label="$2" timeout="${3:-40}" pid="${4:-}"
  for ((i = 1; i <= timeout; i++)); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      log_ok "$label ready (${i}s)"
      return 0
    fi
    if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
      log_error "$label process died — see $LOG_DIR/"
      return 1
    fi
    sleep 1
  done
  log_error "$label not ready after ${timeout}s"
  return 1
}

# ── Database ───────────────────────────────────────────
# Parse DATABASE_URL without exporting anything.
db_url_field() {
  python3 - "$1" "${DATABASE_URL:-}" <<'PY'
import sys
from urllib.parse import urlparse
field, url = sys.argv[1], sys.argv[2]
p = urlparse(url)
print({
    "host": p.hostname or "localhost",
    "port": str(p.port or 5432),
    "user": p.username or "",
    "name": (p.path or "").lstrip("/"),
}.get(field, ""))
PY
}

check_local_db() {
  have pg_isready || { log_warn "pg_isready not installed — skipping DB check"; return 0; }
  local host port user name
  host="$(db_url_field host)"; port="$(db_url_field port)"
  user="$(db_url_field user)"; name="$(db_url_field name)"
  if pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1; then
    log_ok "PostgreSQL reachable at ${host}:${port} (${name})"
    return 0
  fi
  log_error "PostgreSQL not reachable at ${host}:${port} — check DATABASE_URL"
  return 1
}

check_docker_db() {
  for ((i = 1; i <= 30; i++)); do
    if $COMPOSE exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      log_ok "PostgreSQL ready (${i}s)"
      return 0
    fi
    sleep 1
  done
  log_error "PostgreSQL not ready after 30s — check: docker compose logs db"
  return 1
}

activate_venv() {
  [[ -d "$VENV_DIR" ]] || die "backend/venv missing — run ./scripts/setup.sh local"
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
}
