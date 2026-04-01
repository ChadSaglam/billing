#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# project-overview.sh — Comprehensive project health & stats
# chadev-billing: Invoicing & Document Management
# ─────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
COMPOSE="docker compose"
BACKEND_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:5173"
DB_USER="${POSTGRES_USER:-chadev}"
DB_NAME="${POSTGRES_DB:-chadev_billing}"

if [[ -f ".env" ]]; then
  set -a; source .env; set +a
fi

echo -e "${BOLD}🧾 chadev-billing — Project Overview${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Git ─────────────────────────────────────────────────
if [[ -d .git ]]; then
  branch=$(git branch --show-current 2>/dev/null || echo "unknown")
  commit=$(git log -1 --format="%h %s" 2>/dev/null || echo "no commits")
  dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d " ")
  latest_tag=$(git tag --sort=-version:refname 2>/dev/null | head -1)

  echo -e "${BOLD}Git${RESET}"
  echo "  Branch:  ${branch}"
  echo "  Last:    ${commit}"
  [[ -n "$latest_tag" ]] && echo "  Tag:     ${latest_tag}"
  if [[ "$dirty" -gt 0 ]]; then
    echo -e "  Status:  ${YELLOW}${dirty} uncommitted changes${RESET}"
  else
    echo -e "  Status:  ${GREEN}Clean${RESET}"
  fi
  echo ""
fi

# ── Code Stats ──────────────────────────────────────────
echo -e "${BOLD}Code Stats${RESET}"
py_files=$(find backend -name "*.py" -not -path "*__pycache__*" -not -path "*/venv/*" -not -path "*alembic/versions*" 2>/dev/null | wc -l | tr -d " ")
py_lines=$(find backend -name "*.py" -not -path "*__pycache__*" -not -path "*/venv/*" -not -path "*alembic/versions*" -exec cat {} + 2>/dev/null | wc -l | tr -d " ")
tsx_files=$(find frontend/src -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d " ")
tsx_lines=$(find frontend/src \( -name "*.tsx" -o -name "*.ts" \) -exec cat {} + 2>/dev/null | wc -l | tr -d " ")

echo "  Python:     ${py_files} files, ${py_lines} lines"
echo "  TypeScript: ${tsx_files} files, ${tsx_lines} lines"
echo "  Total:      $(( py_files + tsx_files )) files, $(( py_lines + tsx_lines )) lines"
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
  [[ ! -f "$f" ]] && continue
  name=$(basename "$f" .py)
  [[ "$name" == "__init__" ]] && continue
  routes=$(grep -cE "^@router\.(get|post|put|delete|patch)|^\s+@router\.(get|post|put|delete|patch)" "$f" 2>/dev/null || echo "0")
  printf "    %-20s %2s routes\n" "$name" "$routes"
done
echo ""

echo -e "  ${DIM}Models:${RESET}"
for f in backend/app/models/*.py; do
  [[ ! -f "$f" ]] && continue
  name=$(basename "$f" .py)
  [[ "$name" == "__init__" ]] && continue
  cols=$(grep -cE "^\s+\w+\s*=\s*Column\b|^\s+\w+:\s*Mapped" "$f" 2>/dev/null || echo "?")
  printf "    %-20s %s columns\n" "$name" "$cols"
done
echo ""

echo -e "  ${DIM}Services:${RESET}"
for f in backend/app/services/*.py; do
  [[ ! -f "$f" ]] && continue
  name=$(basename "$f" .py)
  [[ "$name" == "__init__" ]] && continue
  funcs=$(grep -cE "^(async )?def " "$f" 2>/dev/null || echo "0")
  lines=$(wc -l < "$f" | tr -d " ")
  printf "    %-20s %2s functions  %s lines\n" "$name" "$funcs" "$lines"
done
echo ""

echo -e "  ${DIM}Schemas:${RESET}"
for f in backend/app/schemas/*.py; do
  [[ ! -f "$f" ]] && continue
  name=$(basename "$f" .py)
  [[ "$name" == "__init__" ]] && continue
  classes=$(grep -cE "^class " "$f" 2>/dev/null || echo "0")
  printf "    %-20s %2s schemas\n" "$name" "$classes"
done
echo ""

# ── Frontend Detail ─────────────────────────────────────
echo -e "${BOLD}Frontend${RESET}"
echo "  Framework:  React + Vite + TypeScript"
echo "  Styling:    Tailwind CSS + shadcn/ui"
echo "  Node:       $(node --version 2>/dev/null || echo '?')"
echo ""

echo -e "  ${DIM}Pages:${RESET}"
while IFS= read -r f; do
  name=$(basename "$f" .tsx)
  lines=$(wc -l < "$f" | tr -d " ")
  printf "    %-25s %s lines\n" "$name" "$lines"
done < <(find frontend/src/pages -name "*.tsx" 2>/dev/null | sort)
echo ""

echo -e "  ${DIM}Components:${RESET}"
while IFS= read -r f; do
  name=$(basename "$f" .tsx)
  lines=$(wc -l < "$f" | tr -d " ")
  printf "    %-25s %s lines\n" "$name" "$lines"
done < <(find frontend/src/components -name "*.tsx" -not -path "*/ui/*" 2>/dev/null | sort)
ui_count=$(find frontend/src/components/ui -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
echo -e "    ${DIM}+ ${ui_count} shadcn/ui primitives${RESET}"
echo ""

echo -e "  ${DIM}Hooks:${RESET}"
while IFS= read -r f; do
  name=$(basename "$f" | sed 's/\.\(ts\|tsx\)$//')
  printf "    %s\n" "$name"
done < <(find frontend/src/hooks -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort)
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
  db_size=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null | tr -d " " || echo "?")
  table_count=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "?")
  echo -e "  PostgreSQL: ${GREEN}● Running${RESET} (${db_size}, ${table_count} tables)"

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
for env_file in .env backend/.env frontend/.env; do
  if [[ -f "$env_file" ]]; then
    vars=$(grep -cE "^[A-Z_]+=" "$env_file" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}✓${RESET} ${env_file} (${vars} vars)"
  else
    echo -e "  ${DIM}⊘${RESET} ${env_file} not present"
  fi
done

echo ""

# ── Disk Usage ──────────────────────────────────────────
echo -e "${BOLD}Disk Usage${RESET}"
backend_size=$(find backend -not -path "*/venv/*" -not -path "*/__pycache__/*" -type f -exec cat {} + 2>/dev/null | wc -c | awk '{printf "%.1fM", $1/1048576}')
frontend_size=$(find frontend/src -type f -exec cat {} + 2>/dev/null | wc -c | awk '{printf "%.0fK", $1/1024}')
nm_size=$(du -sh frontend/node_modules 2>/dev/null | cut -f1 || echo "N/A")
echo "  Backend:       ${backend_size}"
echo "  Frontend src:  ${frontend_size}"
echo "  node_modules:  ${nm_size}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"