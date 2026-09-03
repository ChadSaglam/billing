#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# project-overview.sh — project health, stats & AI handoff
#
# Usage:
#   ./scripts/project-overview.sh            # human report
#   ./scripts/project-overview.sh --json     # machine/AI snapshot
#   ./scripts/project-overview.sh --brief    # one-screen summary
#   ./scripts/project-overview.sh --ai       # paste-ready AI context block
#
# Everything is derived from .env — no hardcoded ports, DB names or URLs.
# ─────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

MODE="human"
case "${1:-}" in
  --json)  MODE="json" ;;
  --brief) MODE="brief" ;;
  --ai)    MODE="ai" ;;
  --help|-h)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 0 ;;
esac

# ── Load .env FIRST so every default below can be overridden ──────────
# NOTE: deliberately NOT `set -a`. Exporting .env into the environment breaks
# JSON-valued settings — bash strips the quotes from ALLOWED_ORIGINS=["..."],
# and pydantic-settings then fails to parse it in any child process (pytest,
# alembic, uvicorn). The values are still readable by this script.
if [[ -f ".env" ]]; then
  source .env
fi

# ── Everything derived, nothing hardcoded ─────────────────────────────
COMPOSE="docker compose"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"
APP_NAME="${APP_NAME:-billing}"
APP_ENV="${APP_ENV:-unknown}"
BACKEND_URL="${VITE_API_URL:-http://localhost:${BACKEND_PORT}}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m"
if [[ "$MODE" == "json" ]] || [[ ! -t 1 ]]; then
  CYAN=""; GREEN=""; YELLOW=""; RED=""; RESET=""; BOLD=""; DIM=""
fi

have() { command -v "$1" >/dev/null 2>&1; }
jstr() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

# ═════════════════════════════════════════════════════════
# COLLECT — every fact gathered once, rendered per mode
# ═════════════════════════════════════════════════════════

# ── Git ────────────────────────────────────────────────
GIT_BRANCH="n/a"; GIT_COMMIT="n/a"; GIT_DIRTY=0; GIT_TAG=""; GIT_AHEAD="?"
if [[ -d .git ]] && have git; then
  GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
  GIT_COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "no commits")
  GIT_DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  GIT_TAG=$(git tag --sort=-version:refname 2>/dev/null | head -1)
  GIT_AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo "no-upstream")
fi

# ── Code stats ─────────────────────────────────────────
count_lines() { find "$@" -type f -exec cat {} + 2>/dev/null | wc -l | tr -d ' '; }
PY_FILES=$(find backend -name '*.py' -not -path '*__pycache__*' -not -path '*/venv/*' -not -path '*/tests/*' 2>/dev/null | wc -l | tr -d ' ')
PY_LINES=$(find backend -name '*.py' -not -path '*__pycache__*' -not -path '*/venv/*' -not -path '*/tests/*' -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
TEST_FILES=$(find backend/tests -name 'test_*.py' 2>/dev/null | wc -l | tr -d ' ')
TEST_LINES=$(find backend/tests -name '*.py' -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
TS_FILES=$(find frontend/src \( -name '*.tsx' -o -name '*.ts' \) 2>/dev/null | wc -l | tr -d ' ')
TS_LINES=$(find frontend/src \( -name '*.tsx' -o -name '*.ts' \) -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
E2E_FILES=$(find frontend/e2e -name '*.spec.ts' 2>/dev/null | wc -l | tr -d ' ')
TEST_RATIO=$(python3 -c "print(f'{${TEST_LINES:-0}/max(${PY_LINES:-1},1)*100:.0f}')" 2>/dev/null || echo "?")

# ── Quality gates ──────────────────────────────────────
RUFF_STATUS="not-installed"; RUFF_ERRORS=0
if have ruff; then
  ruff_out=$(cd backend && ruff check app tests 2>&1)
  if echo "$ruff_out" | grep -q "All checks passed"; then
    RUFF_STATUS="clean"
  else
    RUFF_ERRORS=$(echo "$ruff_out" | grep -oE "Found [0-9]+ error" | grep -oE "[0-9]+" | head -1)
    RUFF_STATUS="${RUFF_ERRORS:-?} errors"
  fi
fi

PYTEST_STATUS="not-run"; PYTEST_PASSED=0; PYTEST_FAILED=0
if [[ "${RUN_TESTS:-false}" == "true" ]] && have pytest; then
  # NOTE: pyproject addopts already contains -q; passing another makes it -qq,
  # which suppresses the summary line this parser needs.
  pt=$(cd backend && pytest --color=no --tb=no -p no:cacheprovider 2>&1)
  PYTEST_PASSED=$(echo "$pt" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" | tail -1)
  PYTEST_FAILED=$(echo "$pt" | grep -oE "[0-9]+ (failed|error)" | grep -oE "[0-9]+" | tail -1)
  PYTEST_SKIPPED=$(echo "$pt" | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" | tail -1)
  if [[ -z "${PYTEST_PASSED}${PYTEST_FAILED}" ]]; then
    # Show what pytest actually said instead of hiding it
    PYTEST_STATUS="unparsed: $(echo "$pt" | grep -v '^$' | tail -1 | cut -c1-70)"
  elif [[ "${PYTEST_FAILED:-0}" -gt 0 ]]; then
    PYTEST_STATUS="${PYTEST_FAILED} failed / ${PYTEST_PASSED:-0} passed"
  else
    PYTEST_STATUS="clean (${PYTEST_PASSED:-0} passed, ${PYTEST_SKIPPED:-0} skipped)"
  fi
fi

# ── CI ─────────────────────────────────────────────────
CI_WORKFLOWS=$(find .github/workflows -name '*.yml' 2>/dev/null | wc -l | tr -d ' ')
CI_LAST="n/a"
if have gh && [[ "$CI_WORKFLOWS" -gt 0 ]]; then
  CI_LAST=$(gh run list --limit 1 --json conclusion,workflowName \
    -q '.[0] | "\(.workflowName): \(.conclusion // "running")"' 2>/dev/null || echo "n/a")
fi

# ── Roadmap ────────────────────────────────────────────
RM_DONE=0; RM_OPEN=0; RM_NOW=0
if [[ -f ROADMAP.md ]]; then
  RM_DONE=$(grep -c '^- \[x\]' ROADMAP.md 2>/dev/null || echo 0)
  RM_OPEN=$(grep -c '^- \[ \]' ROADMAP.md 2>/dev/null || echo 0)
  RM_NOW=$(awk '/^## 🔥 NOW/,/^## ⏭/' ROADMAP.md 2>/dev/null | grep -c '^- \[ \]' || echo 0)
fi

# ── Runtime probes ─────────────────────────────────────
probe() { curl -sf -o /dev/null --max-time 3 "$1" 2>/dev/null && echo up || echo down; }
API_STATE=$(probe "${BACKEND_URL}/api/health")
FE_STATE=$(probe "${FRONTEND_URL}")
API_ENDPOINTS="?"
if [[ "$API_STATE" == "up" ]]; then
  API_ENDPOINTS=$(curl -sf "${BACKEND_URL}/openapi.json" 2>/dev/null | python3 -c "
import sys,json
try:
    s=json.load(sys.stdin)
    print(sum(1 for p in s.get('paths',{}).values() for m in p if m.upper() in ('GET','POST','PUT','PATCH','DELETE')))
except Exception: print('?')" 2>/dev/null || echo "?")
fi

DOCKER_STATE="unavailable"; DOCKER_SERVICES=""
if have docker && docker info >/dev/null 2>&1; then
  DOCKER_STATE="running"
  DOCKER_SERVICES=$($COMPOSE ps --format '{{.Service}}:{{.State}}' 2>/dev/null | tr '\n' ' ')
fi

DB_STATE="unreachable"; DB_SIZE="?"; DB_TABLES="?"; DB_MIGRATION="?"
if [[ "$DOCKER_STATE" == "running" ]] && $COMPOSE exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  DB_STATE="up"
  DB_SIZE=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null | tr -d ' ')
  DB_TABLES=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
  DB_MIGRATION=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null | tr -d ' ')
fi
MIGRATION_FILES=$(find backend/alembic/versions -name '*.py' 2>/dev/null | wc -l | tr -d ' ')

# ── Config drift detection (this is what stops silent breakage) ───────
WARNINGS=()
DB_URL_PORT=$(echo "${DATABASE_URL:-}" | sed -nE 's#.*:([0-9]+)/.*#\1#p')
DB_URL_NAME=$(echo "${DATABASE_URL:-}" | sed -nE 's#.*/([^/?]+)$#\1#p')
[[ -n "$DB_URL_PORT" && "$DB_URL_PORT" != "$DB_PORT" ]] && \
  WARNINGS+=("DATABASE_URL port ${DB_URL_PORT} != DB_PORT ${DB_PORT} — local and Docker are two different databases")
[[ -n "$DB_URL_NAME" && "$DB_URL_NAME" != "$DB_NAME" ]] && \
  WARNINGS+=("DATABASE_URL db '${DB_URL_NAME}' != POSTGRES_DB '${DB_NAME}'")
COMPOSE_BE_PORT=$(grep -oE '"[0-9]+:8000"' docker-compose.yml 2>/dev/null | head -1 | tr -d '"' | cut -d: -f1)
[[ -n "$COMPOSE_BE_PORT" && "$COMPOSE_BE_PORT" != "$BACKEND_PORT" ]] && \
  WARNINGS+=("docker-compose publishes backend on :${COMPOSE_BE_PORT} but BACKEND_PORT=${BACKEND_PORT} — the Docker API is not where the frontend looks")
COMPOSE_FE=$($COMPOSE config --services 2>/dev/null | grep -c '^frontend$' || echo 0)
[[ "$COMPOSE_FE" == "0" ]] && \
  WARNINGS+=("docker-compose has no frontend service — 'docker compose up' does not give you a running app")
GEN_PORT=$(grep -oE 'localhost:[0-9]+' frontend/package.json 2>/dev/null | head -1 | cut -d: -f2)
[[ -n "$GEN_PORT" && "$GEN_PORT" != "$BACKEND_PORT" ]] && \
  WARNINGS+=("package.json generate-api targets :${GEN_PORT} but backend is :${BACKEND_PORT} — generated types will be stale")
[[ ! -f .env ]] && WARNINGS+=(".env missing — every value below is a fallback default")
[[ "$APP_ENV" == "production" ]] && grep -q 'reload' backend/Dockerfile 2>/dev/null && \
  WARNINGS+=("APP_ENV=production but backend Dockerfile still runs uvicorn --reload")
if have git && git ls-files 2>/dev/null | grep -qE '(^|/)\.env$'; then
  WARNINGS+=(".env is tracked by git — secrets are in history")
fi

# ═════════════════════════════════════════════════════════
# RENDER
# ═════════════════════════════════════════════════════════

if [[ "$MODE" == "json" ]]; then
  python3 - "$@" <<PYJSON
import json
warnings = [w for w in """$(printf '%s\n' "${WARNINGS[@]:-}")""".split("\n") if w.strip()]
print(json.dumps({
  "app": {"name": "$APP_NAME", "env": "$APP_ENV"},
  "git": {"branch": "$GIT_BRANCH", "head": "$GIT_COMMIT", "uncommitted": $GIT_DIRTY,
          "tag": "$GIT_TAG", "unpushed": "$GIT_AHEAD"},
  "code": {"python_files": $PY_FILES, "python_lines": $PY_LINES,
           "ts_files": $TS_FILES, "ts_lines": $TS_LINES,
           "test_files": $TEST_FILES, "test_lines": $TEST_LINES,
           "e2e_specs": $E2E_FILES, "test_to_code_percent": "$TEST_RATIO"},
  "quality": {"ruff": "$RUFF_STATUS", "pytest": "$PYTEST_STATUS",
              "ci_workflows": $CI_WORKFLOWS, "ci_last_run": "$CI_LAST"},
  "roadmap": {"done": $RM_DONE, "open": $RM_OPEN, "blocking_now": $RM_NOW},
  "runtime": {"api": "$API_STATE", "api_url": "$BACKEND_URL", "endpoints": "$API_ENDPOINTS",
              "frontend": "$FE_STATE", "frontend_url": "$FRONTEND_URL",
              "docker": "$DOCKER_STATE", "services": "$DOCKER_SERVICES".split(),
              "database": "$DB_STATE", "db_size": "$DB_SIZE", "db_tables": "$DB_TABLES",
              "migration_head": "$DB_MIGRATION", "migration_files": $MIGRATION_FILES},
  "warnings": warnings,
}, indent=2))
PYJSON
  exit 0
fi

status_dot() {
  case "$1" in
    up|running|clean|clean*) echo -e "${GREEN}●${RESET}" ;;
    not-run|not-installed|"")  echo -e "${DIM}●${RESET}" ;;
    *) echo -e "${RED}●${RESET}" ;;
  esac
}

echo -e "${BOLD}🧾 ${APP_NAME} — Project Overview${RESET}  ${DIM}(${APP_ENV})${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${BOLD}Health${RESET}"
printf "  %s API        %s  %s endpoints\n"  "$(status_dot "$API_STATE")"    "$BACKEND_URL"  "$API_ENDPOINTS"
printf "  %s Frontend   %s\n"                "$(status_dot "$FE_STATE")"     "$FRONTEND_URL"
printf "  %s Database   %s  %s tables · %s · head %s\n" "$(status_dot "$DB_STATE")" "$DB_NAME" "$DB_TABLES" "$DB_SIZE" "${DB_MIGRATION:-none}"
printf "  %s Docker     %s\n"                "$(status_dot "$DOCKER_STATE")" "${DOCKER_SERVICES:-not running}"
echo ""

echo -e "${BOLD}Quality gates${RESET}"
printf "  %s Lint (ruff)     %s\n" "$(status_dot "$RUFF_STATUS")" "$RUFF_STATUS"
printf "  %s Tests           %s  ${DIM}(RUN_TESTS=true to execute)${RESET}\n" "$(status_dot "$PYTEST_STATUS")" "$PYTEST_STATUS"
printf "    CI workflows    %s   last: %s\n" "$CI_WORKFLOWS" "$CI_LAST"
printf "    Migrations      %s files, applied head %s\n" "$MIGRATION_FILES" "${DB_MIGRATION:-unknown}"
echo ""

echo -e "${BOLD}Roadmap${RESET}"
printf "  Done %s · Open %s · ${YELLOW}Blocking now %s${RESET}\n" "$RM_DONE" "$RM_OPEN" "$RM_NOW"
if [[ -f ROADMAP.md ]] && [[ "$RM_NOW" -gt 0 ]]; then
  awk '/^## 🔥 NOW/,/^## ⏭/' ROADMAP.md | grep '^- \[ \]' | head -3 \
    | sed -E 's/^- \[ \] \*\*([A-Z0-9-]+)\*\* /    \1  /' | cut -c1-96
fi
echo ""

if [[ ${#WARNINGS[@]} -gt 0 ]] && [[ -n "${WARNINGS[0]:-}" ]]; then
  echo -e "${BOLD}${YELLOW}Config drift${RESET}"
  for w in "${WARNINGS[@]}"; do echo -e "  ${YELLOW}⚠${RESET}  $w"; done
  echo ""
fi

[[ "$MODE" == "brief" ]] && { echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; exit 0; }

echo -e "${BOLD}Git${RESET}"
echo "  Branch:  ${GIT_BRANCH}"
echo "  Head:    ${GIT_COMMIT}"
[[ -n "$GIT_TAG" ]] && echo "  Tag:     ${GIT_TAG}"
if [[ "$GIT_DIRTY" -gt 0 ]]; then
  echo -e "  Status:  ${YELLOW}${GIT_DIRTY} uncommitted${RESET}, ${GIT_AHEAD} unpushed"
else
  echo -e "  Status:  ${GREEN}clean${RESET}, ${GIT_AHEAD} unpushed"
fi
echo ""

echo -e "${BOLD}Code${RESET}"
printf "  Backend     %4s files  %6s lines\n" "$PY_FILES" "$PY_LINES"
printf "  Frontend    %4s files  %6s lines\n" "$TS_FILES" "$TS_LINES"
printf "  Tests       %4s files  %6s lines  ${DIM}(%s%% of backend)${RESET}\n" "$TEST_FILES" "$TEST_LINES" "$TEST_RATIO"
printf "  E2E specs   %4s\n" "$E2E_FILES"
echo ""

echo -e "${BOLD}Backend modules${RESET}"
for group in api models services schemas; do
  printf "  ${DIM}%s${RESET}\n" "$group"
  for f in backend/app/${group}/*.py; do
    [[ -f "$f" ]] || continue
    name=$(basename "$f" .py); [[ "$name" == "__init__" ]] && continue
    lines=$(wc -l < "$f" | tr -d ' ')
    case "$group" in
      api)      n=$(grep -cE '^\s*@router\.(get|post|put|delete|patch)' "$f");  unit="routes" ;;
      models)   n=$(grep -cE '^\s+\w+:\s*Mapped|^\s+\w+\s*=\s*Column\b' "$f");  unit="columns" ;;
      services) n=$(grep -cE '^(async )?def ' "$f");                            unit="funcs" ;;
      schemas)  n=$(grep -cE '^class ' "$f");                                   unit="schemas" ;;
    esac
    printf "    %-22s %3s %-8s %4s lines\n" "$name" "$n" "$unit" "$lines"
  done
done
echo ""

echo -e "${BOLD}Frontend${RESET}"
echo "  Node $(node --version 2>/dev/null || echo '?') · $(find frontend/src/pages -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ') pages · $(find frontend/src/components -name '*.tsx' -not -path '*/ui/*' 2>/dev/null | wc -l | tr -d ' ') components · $(find frontend/src/components/ui -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ') ui primitives · $(find frontend/src/hooks -type f 2>/dev/null | wc -l | tr -d ' ') hooks"
echo -e "  ${DIM}Largest files (refactor candidates):${RESET}"
find frontend/src -name '*.tsx' -not -path '*/ui/*' -exec wc -l {} + 2>/dev/null \
  | sort -rn | sed -n '2,6p' | awk '{printf "    %5s  %s\n", $1, $2}'
echo ""

echo -e "${BOLD}Environment${RESET}"
printf "  Ports:  frontend %s · backend %s · db %s\n" "$FRONTEND_PORT" "$BACKEND_PORT" "$DB_PORT"
for env_file in .env backend/.env frontend/.env; do
  if [[ -f "$env_file" ]]; then
    echo -e "  ${GREEN}✓${RESET} ${env_file} ($(grep -cE '^[A-Z_]+=' "$env_file") vars)"
  else
    echo -e "  ${DIM}⊘ ${env_file}${RESET}"
  fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${DIM}--json for a machine snapshot · --ai for an AI context block · --brief for one screen${RESET}"

if [[ "$MODE" == "ai" ]]; then
  echo ""
  echo "─── AI CONTEXT (copy below) ───────────────────────"
  echo "PROJECT: ${APP_NAME} (${APP_ENV}) — multi-tenant Swiss invoicing SaaS"
  echo "STACK: FastAPI + SQLAlchemy + Alembic + PostgreSQL · React 19 + Vite + TS + Tailwind + shadcn/ui"
  echo "SIZE: ${PY_LINES} py / ${TS_LINES} ts lines · ${TEST_FILES} test files (${TEST_RATIO}% ratio) · ${E2E_FILES} e2e specs"
  echo "GIT: ${GIT_BRANCH} @ ${GIT_COMMIT} · ${GIT_DIRTY} uncommitted"
  echo "GATES: ruff=${RUFF_STATUS} · pytest=${PYTEST_STATUS} · ci=${CI_WORKFLOWS} workflows"
  echo "RUNTIME: api=${API_STATE} fe=${FE_STATE} db=${DB_STATE} docker=${DOCKER_STATE} migration=${DB_MIGRATION}"
  echo "ROADMAP: ${RM_DONE} done / ${RM_OPEN} open / ${RM_NOW} blocking"
  if [[ -f ROADMAP.md ]]; then
    echo "BLOCKING ITEMS:"
    awk '/^## 🔥 NOW/,/^## ⏭/' ROADMAP.md | grep '^- \[ \]' | sed 's/^- \[ \]/  -/' | cut -c1-140
  fi
  if [[ ${#WARNINGS[@]} -gt 0 ]] && [[ -n "${WARNINGS[0]:-}" ]]; then
    echo "CONFIG DRIFT:"
    for w in "${WARNINGS[@]}"; do echo "  - $w"; done
  fi
  echo "───────────────────────────────────────────────────"
fi
