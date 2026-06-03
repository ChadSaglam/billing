#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ── Parse args ─────────────────────────────
CLIENT_NAME=""
CLIENT_SLUG=""
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
MODE="local"
DB_PORT=5432
BACKEND_PORT=8002
FRONTEND_PORT=5173
SEED_FILE=""
LOGO_FILE=""
TENANT_ID=1

while [[ $# -gt 0 ]]; do
  case $1 in
    --client-name) CLIENT_NAME="$2"; shift ;;
    --client-slug) CLIENT_SLUG="$2"; shift ;;
    --tenant-id) TENANT_ID="$2"; shift ;;
    --admin-email) ADMIN_EMAIL="$2"; shift ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift ;;
    --mode) MODE="$2"; shift ;;
    --db-port) DB_PORT="$2"; shift ;;
    --backend-port) BACKEND_PORT="$2"; shift ;;
    --frontend-port) FRONTEND_PORT="$2"; shift ;;
    --seed-file) SEED_FILE="$2"; shift ;;
    --logo-file) LOGO_FILE="$2"; shift ;;
  esac
  shift
done

[[ -n "$CLIENT_SLUG" ]] || fail "--client-slug is required"
[[ -f "$SEED_FILE" ]] || fail "seed file not found: $SEED_FILE"

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$PROJECT_ROOT/scripts/clients/$CLIENT_SLUG/.runtime"
mkdir -p "$RUNTIME_DIR/logs"

# ── Port resolution ──────────────────────────
if [[ "$MODE" == "docker" ]]; then
  DB_PORT=$(find_free_port "$DB_PORT")
fi
BACKEND_PORT=$(find_free_port "$BACKEND_PORT")
FRONTEND_PORT=$(find_free_port "$FRONTEND_PORT")

info "Ports → DB:$DB_PORT API:$BACKEND_PORT UI:$FRONTEND_PORT"

SECRET_KEY="$(openssl rand -hex 32)"

# ════════════════════════════════════════════
#  LOCAL MODE — reuse existing Postgres creds
# ════════════════════════════════════════════
if [[ "$MODE" == "local" ]]; then
  
  ROOT_ENV="$PROJECT_ROOT/.env"
  DB_URL_LINE="$(grep '^DATABASE_URL=' "$ROOT_ENV" | head -n1 || true)"
  CLIENT_DB_URL="${DB_URL_LINE#*=}"

# ════════════════════════════════════════════
#  DOCKER MODE — generated credentials
# ════════════════════════════════════════════
else
  DB_PASS="$(openssl rand -hex 16)"
  CLIENT_DB_URL="postgresql://chadev:${DB_PASS}@db:5432/${CLIENT_SLUG}"
fi

# ── Generate client .env ─────────────────────
ENV_FILE="$RUNTIME_DIR/.env"
cat > "$ENV_FILE" <<EOF
DATABASE_URL=${CLIENT_DB_URL}
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
ALGORITHM=HS256
ALLOWED_ORIGINS=["http://localhost:${FRONTEND_PORT}"]
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=${ADMIN_EMAIL}
EOF
chmod 600 "$ENV_FILE"
ok "Generated runtime env"

# Tell Python (backend, alembic, seed_loader) to read THIS env file
export ENV_FILE="$ENV_FILE"

# ── Prepare logo & uploads ───────────────────
mkdir -p "$PROJECT_ROOT/backend/uploads/logos"
mkdir -p "$PROJECT_ROOT/uploads"
if [[ -f "$LOGO_FILE" ]]; then
  cp "$LOGO_FILE" "$PROJECT_ROOT/backend/uploads/logos/${CLIENT_SLUG}_logo.png"
  ok "Logo staged"
fi

# ════════════════════════════════════════════
#  DOCKER
# ════════════════════════════════════════════
if [[ "$MODE" == "docker" ]]; then
  require_cmd docker "Install Docker Desktop / Engine with compose plugin"

  COMPOSE_FILE="$RUNTIME_DIR/docker-compose.yml"
  cat > "$COMPOSE_FILE" <<EOF
name: chadev-${CLIENT_SLUG}
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: chadev
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: chadev_${CLIENT_SLUG}
    ports:
      - "${DB_PORT}:5432"
    volumes:
      - pgdata_${CLIENT_SLUG}:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chadev -d chadev_${CLIENT_SLUG}"]
      interval: 5s
      timeout: 5s
      retries: 5
  backend:
    build:
      context: ${PROJECT_ROOT}/backend
    environment:
      DATABASE_URL: ${CLIENT_DB_URL}
      SECRET_KEY: ${SECRET_KEY}
      ALLOWED_ORIGINS: '["http://localhost:${FRONTEND_PORT}"]'
      FRONTEND_URL: http://localhost:${FRONTEND_PORT}
    ports:
      - "${BACKEND_PORT}:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ${PROJECT_ROOT}/backend:/app
      - ${PROJECT_ROOT}/backend/uploads:/app/uploads
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
  frontend:
    build:
      context: ${PROJECT_ROOT}/frontend
    ports:
      - "${FRONTEND_PORT}:5173"
    depends_on:
      - backend
volumes:
  pgdata_${CLIENT_SLUG}:
EOF

  info "Starting Docker services ..."
  docker compose -f "$COMPOSE_FILE" -p "chadev-${CLIENT_SLUG}" up -d --build db

  for _ in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U chadev >/dev/null 2>&1; then
      ok "Database is ready"; break
    fi
    sleep 1
  done

  info "Seeding data ..."
  docker compose -f "$COMPOSE_FILE" run --rm \
    -v "$SEED_FILE:/tmp/seed.json:ro" \
    -v "$SCRIPT_DIR/lib/seed_loader.py:/tmp/seed_loader.py:ro" \
    backend \
    python /tmp/seed_loader.py --seed /tmp/seed.json

  docker compose -f "$COMPOSE_FILE" up -d

# ════════════════════════════════════════════
#  LOCAL – simplified: venv setup, seed, start
# ════════════════════════════════════════════
else
  require_cmd python3 "Install Python 3.12+"
  require_cmd node "Install Node.js"
  require_cmd npm "Install npm"
  require_cmd psql "Install PostgreSQL client tools"
  require_cmd pg_isready "Install PostgreSQL client tools"

  VENV="$PROJECT_ROOT/backend/venv"
  if [[ ! -d "$VENV" ]]; then
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -r "$PROJECT_ROOT/backend/requirements.txt"
    ok "Backend venv created"
  fi

  if [[ ! -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
    (cd "$PROJECT_ROOT/frontend" && npm install)
    ok "Frontend dependencies installed"
  fi

  info "Seeding client database…"
  PYTHONPATH="$PROJECT_ROOT/backend" "$VENV/bin/python" \
    "$SCRIPT_DIR/lib/seed_loader.py" --seed "$SEED_FILE" --slug "$CLIENT_SLUG" --tenant-id "$TENANT_ID"

  # ── Update root .env to point to the freshly seeded client DB ─────
  if [[ "$MODE" == "local" ]]; then
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${CLIENT_DB_URL}|" "$PROJECT_ROOT/.env"
    ok "Root .env DATABASE_URL updated to ${CLIENT_DB_URL}"
  fi

  # Start backend and frontend
  BACKEND_PID=""
  FRONTEND_PID=""
  cleanup() {
    info "Shutting down local services ..."
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  }
  trap cleanup EXIT SIGINT SIGTERM

  (
    cd "$PROJECT_ROOT/backend"
    source "$VENV/bin/activate"
    uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT"
  ) > "$RUNTIME_DIR/logs/backend.log" 2>&1 &
  BACKEND_PID=$!

  for _ in $(seq 1 40); do
    if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
      ok "Backend is ready"; break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      fail "Backend crashed. See $RUNTIME_DIR/logs/backend.log"
    fi
    sleep 1
  done

  (
    cd "$PROJECT_ROOT/frontend"
    VITE_API_URL="http://localhost:${BACKEND_PORT}" npx vite --host 0.0.0.0 --port "$FRONTEND_PORT"
  ) > "$RUNTIME_DIR/logs/frontend.log" 2>&1 &
  FRONTEND_PID=$!

  for _ in $(seq 1 40); do
    if curl -sf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
      ok "Frontend is ready"; break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      fail "Frontend crashed. See $RUNTIME_DIR/logs/frontend.log"
    fi
    sleep 1
  done
fi

# ── Handover ─────────────────────────────────
ok "Provisioning complete!"
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      ChaDev Billing – Client Install Done          ║${RESET}"
echo -e "${BOLD}╠════════════════════════════════════════════════════╣${RESET}"
printf "║  %-18s %s\n" "Client:" "$CLIENT_NAME"
printf "║  %-18s %s\n" "Mode:" "$MODE"
printf "║  %-18s %s\n" "App URL:" "http://localhost:${FRONTEND_PORT}"
printf "║  %-18s %s\n" "API URL:" "http://localhost:${BACKEND_PORT}"
printf "║  %-18s %s\n" "Docs:" "http://localhost:${BACKEND_PORT}/docs"
printf "║  %-18s %s\n" "Admin Email:" "$ADMIN_EMAIL"
printf "║  %-18s %s\n" "Logs:" "$RUNTIME_DIR/logs"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${RESET}"
echo ""

if [[ "$MODE" == "local" ]]; then
  echo "Press Ctrl+C to stop all services."
  wait "$BACKEND_PID" "$FRONTEND_PID"
fi