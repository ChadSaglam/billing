#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# dev.sh — Start all services for local development
# chadev-billing: Invoicing & Document Management
# ─────────────────────────────────────────────────────────
set -euo pipefail

trap 'echo ""; echo "Shutting down..."; docker compose down; kill 0 2>/dev/null; exit 0' SIGINT SIGTERM

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RESET="\033[0m"; BOLD="\033[1m"

echo -e "${BOLD}🧾 chadev-billing — Development Mode${RESET}"
echo ""

# ── Check port 5433 conflict ──────────────────────────
if lsof -i :5433 -sTCP:LISTEN > /dev/null 2>&1; then
  echo -e "${YELLOW}⊘ Port 5433 already in use — DB will use Docker internal network only${RESET}"
  if grep -q '"5434:5433"' docker-compose.yml 2>/dev/null; then
    echo -e "  ${CYAN}Tip: Comment out db ports in docker-compose.yml${RESET}"
  fi
fi

# ── Start Docker services ─────────────────────────────
echo -e "${CYAN}Starting Docker services (db + backend)...${RESET}"
docker compose up -d db
echo -e "  ${GREEN}✓${RESET} Database starting"

# Wait for DB
echo -e "${CYAN}Waiting for PostgreSQL...${RESET}"
for i in {1..20}; do
  if docker compose exec -T db pg_isready -U chadev -d chadev_billing > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${RESET} PostgreSQL ready"
    break
  fi
  [ "$i" -eq 20 ] && echo -e "  ${YELLOW}⊘ PostgreSQL not ready after 20s${RESET}"
  sleep 1
done

# ── Backend ────────────────────────────────────────────
echo -e "${CYAN}Starting backend (port 8000)...${RESET}"
docker compose up -d backend

for i in {1..15}; do
  if curl -sf http://localhost:8000/docs > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${RESET} Backend ready"
    break
  fi
  [ "$i" -eq 15 ] && echo -e "  ${YELLOW}⊘ Backend not ready after 15s${RESET}"
  sleep 1
done

# ── Frontend ───────────────────────────────────────────
echo -e "${CYAN}Starting frontend (port 5173)...${RESET}"
cd frontend
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo -e "  ${YELLOW}⊘ node_modules missing, running npm install...${RESET}"
  npm install
fi
npx vite --host &
FRONTEND_PID=$!
cd ..

for i in {1..10}; do
  if curl -sf http://localhost:5173 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${RESET} Frontend ready"
    break
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}${BOLD}All services running:${RESET}"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Database:  PostgreSQL @ Docker (chadev_billing)"
echo ""
echo "Press Ctrl+C to stop all services."

wait
