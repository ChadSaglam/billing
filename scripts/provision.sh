#!/usr/bin/env bash
# scripts/provision.sh

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/provision.sh \
    --client-name NAME \
    --client-slug SLUG \
    --admin-email EMAIL \
    --admin-password PASSWORD \
    --mode local|docker \
    --db-port PORT \
    --backend-port PORT \
    --frontend-port PORT \
    --seed-file PATH \
    --logo-file PATH
EOF
}

CLIENT_NAME=""
CLIENT_SLUG=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
MODE="local"
DB_PORT=""
BACKEND_PORT=""
FRONTEND_PORT=""
SEED_FILE=""
LOGO_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --client-name) CLIENT_NAME="$2"; shift 2 ;;
    --client-slug) CLIENT_SLUG="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --db-port) DB_PORT="$2"; shift 2 ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
    --seed-file) SEED_FILE="$2"; shift 2 ;;
    --logo-file) LOGO_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

[[ -n "$CLIENT_NAME" ]] || { echo "Missing --client-name"; exit 1; }
[[ -n "$CLIENT_SLUG" ]] || { echo "Missing --client-slug"; exit 1; }
[[ -n "$ADMIN_EMAIL" ]] || { echo "Missing --admin-email"; exit 1; }
[[ -n "$ADMIN_PASSWORD" ]] || { echo "Missing --admin-password"; exit 1; }
[[ -n "$BACKEND_PORT" ]] || { echo "Missing --backend-port"; exit 1; }
[[ -n "$FRONTEND_PORT" ]] || { echo "Missing --frontend-port"; exit 1; }
[[ -n "$SEED_FILE" ]] || { echo "Missing --seed-file"; exit 1; }
[[ -f "$SEED_FILE" ]] || { echo "Seed file not found: $SEED_FILE"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

API_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

wait_for_backend() {
  local url="$1"
  local max_attempts="${2:-120}"
  local i=1
  until curl -sf "$url/api/health" >/dev/null 2>&1; do
    if [[ "$i" -ge "$max_attempts" ]]; then
      echo "ERROR: backend did not become ready: $url"
      exit 1
    fi
    sleep 1
    i=$((i + 1))
  done
}

echo "==> Provisioning: $CLIENT_NAME ($CLIENT_SLUG)"
echo "==> Mode: $MODE"

if [[ "$MODE" == "local" ]]; then
  if [[ -x "$PROJECT_ROOT/scripts/local-setup.sh" ]]; then
    "$PROJECT_ROOT/scripts/local-setup.sh"
  fi

  if [[ -x "$PROJECT_ROOT/scripts/local-db-check.sh" ]]; then
    "$PROJECT_ROOT/scripts/local-db-check.sh"
  fi

  if curl -sf "$API_URL/api/health" >/dev/null 2>&1; then
    echo "==> Backend already running on $API_URL"
  else
    echo "==> Starting local dev services"
    nohup "$PROJECT_ROOT/scripts/local-dev.sh" >"$LOG_DIR/provision-${CLIENT_SLUG}.log" 2>&1 &
    wait_for_backend "$API_URL" 120
  fi
elif [[ "$MODE" == "docker" ]]; then
  echo "ERROR: docker mode is not implemented in this version"
  exit 1
else
  echo "ERROR: invalid mode: $MODE"
  exit 1
fi

echo "==> Running seed"

PYTHON_BIN="$PROJECT_ROOT/backend/venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="python3"
fi

SEED_CMD=(
  "$PYTHON_BIN"
  "$PROJECT_ROOT/scripts/seed.py"
  --api-url "$API_URL"
  --seed-file "$SEED_FILE"
  --admin-email "$ADMIN_EMAIL"
  --admin-password "$ADMIN_PASSWORD"
)

if [[ -n "$LOGO_FILE" && -f "$LOGO_FILE" ]]; then
  SEED_CMD+=(--logo-file "$LOGO_FILE")
fi

"${SEED_CMD[@]}"

echo "==> Done"
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $API_URL"
echo "Docs:     $API_URL/docs"