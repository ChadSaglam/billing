#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# project-overview.sh — Comprehensive project health & stats
# chadev-billing: Invoicing & Document Management
# ─────────────────────────────────────────────────────────
set -uo pipefail

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
COMPOSE="docker compose"
BACKEND_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"
DB_USER="chadev"
DB_NAME="chadev_billing"

echo -e "${BOLD}🧾 chadev-billing — Project Overview${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Git ─────────────────────────────────────────────────
if [ -d .git ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "no commits")
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d " ")
  TAGS=$(git tag --sort=-version:refname 2>/dev/null | head -1)
  echo -e "${BOLD}Git${RESET}"
  echo "  Branch:  ${BRANCH}"
  echo "  Last:    ${COMMIT}"
  [ -n "$TAGS" ] && echo "  Tag:     ${TAGS}"
  if [ "$DIRTY" -gt 0 ]; then
    echo -e "  Status:  ${YELLOW}${DIRTY} uncommitted changes${RESET}"
  else
    echo -e "  Status:  ${GREEN}Clean${RESET}"
  fi
  echo ""
fi

# ── Code Stats ──────────────────────────────────────────
echo -e "${BOLD}Code Stats${RESET}"
PY_FILES=$(find backend -name "*.py" -not -path "*__pycache__*" -not -path "*/venv/*" -not -path "*alembic/versions*" 2>/dev/null | wc -l | tr -d " ")
PY_LINES=$(find backend -name "*.py" -not -path "*__pycache__*" -not -path "*/venv/*" -not -path "*alembic/versions*" -exec cat {} + 2>/dev/null | wc -l | tr -d " ")
TSX_FILES=$(find frontend/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d " ")
TSX_LINES=$(find frontend/src \( -name "*.tsx" -o -name "*.ts" \) -exec cat {} + 2>/dev/null | wc -l | tr -d " ")

echo "  Python:     ${PY_FILES} files, ${PY_LINES} lines"
echo "  TypeScript: ${TSX_FILES} files, ${TSX_LINES} lines"
echo "  Total:      $(( PY_FILES + TSX_FILES )) files, $(( PY_LINES + TSX_LINES )) lines"
echo ""

# ── Architecture ────────────────────────────────────────
echo -e "${BOLD}Architecture${RESET}"
echo "  ┌──────────────┐     ┌───────────────┐     ┌────────────┐"
echo "  │  React/Vite  │────▶│   FastAPI     │────▶│ PostgreSQL │"
echo "  │    :5173     │     │    :8001      │     │   :5432    │"
echo "  └──────────────┘     └───────────────┘     └────────────┘"
echo "   Tailwind/shadcn     SQLAlchemy/Alembic    chadev_billing"
echo ""

# ── Backend Detail ──────────────────────────────────────
echo -e "${BOLD}Backend${RESET}"
echo "  Framework:  FastAPI"
echo "  ORM:        SQLAlchemy + Alembic"
echo "  Database:   PostgreSQL 16"
echo ""

echo -e "  ${DIM}API Routers:${RESET}"
for f in backend/app/api/*.py; do
  [ ! -f "$f" ] && continue
  NAME=$(basename "$f" .py)
  [ "$NAME" = "__init__" ] && continue
  ROUTES=$(grep -cE "^@router\.(get|post|put|delete|patch)|^\s+@router\.(get|post|put|delete|patch)" "$f" 2>/dev/null || echo "0")
  printf "    %-20s %2s routes\n" "$NAME" "$ROUTES"
done
echo ""

echo -e "  ${DIM}Models:${RESET}"
for f in backend/app/models/*.py; do
  [ ! -f "$f" ] && continue
  NAME=$(basename "$f" .py)
  [ "$NAME" = "__init__" ] && continue
  COLS=$(grep -cE "^\s+\w+\s*=\s*Column\b|^\s+\w+:\s*Mapped" "$f" 2>/dev/null || echo "?")
  printf "    %-20s %s columns\n" "$NAME" "$COLS"
done
echo ""

echo -e "  ${DIM}Services:${RESET}"
for f in backend/app/services/*.py; do
  [ ! -f "$f" ] && continue
  NAME=$(basename "$f" .py)
  [ "$NAME" = "__init__" ] && continue
  FUNCS=$(grep -cE "^(async )?def " "$f" 2>/dev/null || echo "0")
  LINES=$(wc -l < "$f" | tr -d " ")
  printf "    %-20s %2s functions  %s lines\n" "$NAME" "$FUNCS" "$LINES"
done
echo ""

echo -e "  ${DIM}Schemas:${RESET}"
for f in backend/app/schemas/*.py; do
  [ ! -f "$f" ] && continue
  NAME=$(basename "$f" .py)
  [ "$NAME" = "__init__" ] && continue
  CLASSES=$(grep -cE "^class " "$f" 2>/dev/null || echo "0")
  printf "    %-20s %2s schemas\n" "$NAME" "$CLASSES"
done
echo ""

# ── Frontend Detail ─────────────────────────────────────
echo -e "${BOLD}Frontend${RESET}"
echo "  Framework:  React + Vite + TypeScript"
echo "  Styling:    Tailwind CSS + shadcn/ui"
echo "  Node:       $(node --version 2>/dev/null || echo '?')"
echo ""

echo -e "  ${DIM}Pages:${RESET}"
for f in $(find frontend/src/pages -name "*.tsx" 2>/dev/null | sort); do
  NAME=$(basename "$f" .tsx)
  LINES=$(wc -l < "$f" | tr -d " ")
  printf "    %-25s %s lines\n" "$NAME" "$LINES"
done
echo ""

echo -e "  ${DIM}Components:${RESET}"
for f in $(find frontend/src/components -name "*.tsx" -not -path "*/ui/*" 2>/dev/null | sort); do
  NAME=$(basename "$f" .tsx)
  LINES=$(wc -l < "$f" | tr -d " ")
  printf "    %-25s %s lines\n" "$NAME" "$LINES"
done
UI_COUNT=$(find frontend/src/components/ui -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
echo -e "    ${DIM}+ ${UI_COUNT} shadcn/ui primitives${RESET}"
echo ""

echo -e "  ${DIM}Hooks:${RESET}"
for f in $(find frontend/src/hooks -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort); do
  NAME=$(basename "$f" | sed 's/\.\(ts\|tsx\)$//')
  printf "    %s\n" "$NAME"
done
echo ""

# ── Docker Compose ──────────────────────────────────────
echo -e "${BOLD}Docker Compose${RESET}"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (compose not running)"
echo ""

# ── Service Status ──────────────────────────────────────
echo -e "${BOLD}Service Status${RESET}"

if curl -sf "${BACKEND_URL}/docs" > /dev/null 2>&1; then
  echo -e "  API:        ${GREEN}● Running${RESET} (port 8001)"
  echo -e "  ${DIM}Docs: ${BACKEND_URL}/docs${RESET}"

  echo -e "  ${DIM}Endpoints:${RESET}"
  curl -sf "${BACKEND_URL}/openapi.json" 2>/dev/null | python3 -c "
import sys, json
spec = json.load(sys.stdin)
for path, methods in sorted(spec.get('paths', {}).items()):
    for method in methods:
        if method.upper() in ('GET','POST','PUT','PATCH','DELETE'):
            print(f'    {method.upper():7s} {path}')
" 2>/dev/null || echo "    (could not parse)"
else
  echo -e "  API:        ${RED}● Offline${RESET}"
fi

if curl -sf "${FRONTEND_URL}" > /dev/null 2>&1; then
  echo -e "  Frontend:   ${GREEN}● Running${RESET} (port 5173)"
else
  echo -e "  Frontend:   ${RED}● Offline${RESET}"
fi

if $COMPOSE exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  DB_SIZE=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null | tr -d " " || echo "?")
  TABLE_COUNT=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "?")
  echo -e "  PostgreSQL: ${GREEN}● Running${RESET} (${DB_SIZE}, ${TABLE_COUNT} tables)"

  echo ""
  echo -e "  ${DIM}Table row counts:${RESET}"
  $COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT '    ' || table_name || ': ' || n_live_tup FROM pg_stat_user_tables ORDER BY table_name;" 2>/dev/null || true
else
  echo -e "  PostgreSQL: ${YELLOW}● Not reachable${RESET}"
fi

echo ""

# ── Environment ─────────────────────────────────────────
echo -e "${BOLD}Environment${RESET}"
for ENV_FILE in .env backend/.env frontend/.env; do
  if [ -f "$ENV_FILE" ]; then
    VARS=$(grep -cE "^[A-Z_]+=" "$ENV_FILE" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}✓${RESET} ${ENV_FILE} (${VARS} vars)"
  else
    echo -e "  ${DIM}⊘${RESET} ${ENV_FILE} not present"
  fi
done

echo ""

# ── Disk Usage ──────────────────────────────────────────
echo -e "${BOLD}Disk Usage${RESET}"
# macOS du doesn't support --exclude, use find + pipe
BACKEND_SIZE=$(find backend -not -path "*/venv/*" -not -path "*/__pycache__/*" -type f -exec cat {} + 2>/dev/null | wc -c | awk '{printf "%.1fM", $1/1048576}')
FRONTEND_SIZE=$(find frontend/src -type f -exec cat {} + 2>/dev/null | wc -c | awk '{printf "%.0fK", $1/1024}')
NM_SIZE=$(du -sh frontend/node_modules 2>/dev/null | cut -f1 || echo "N/A")
echo "  Backend:       ${BACKEND_SIZE}"
echo "  Frontend src:  ${FRONTEND_SIZE}"
echo "  node_modules:  ${NM_SIZE}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
