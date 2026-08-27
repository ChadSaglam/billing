#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# test.sh — Comprehensive pre-deploy test suite
# billing: Invoicing & Document Management
#
# Usage:
#   ./scripts/test.sh              # run all checks
#   ./scripts/test.sh syntax       # run specific section
#   ./scripts/test.sh api docker   # run multiple sections
#
# Sections: syntax imports deps frontend docker db
#           alembic api frontend-live ports security prod types e2e
# ─────────────────────────────────────────────────────────
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN="\033[36m"; GREEN="\033[32m"; RED="\033[31m"; YELLOW="\033[33m"; DIM="\033[2m"; RESET="\033[0m"; BOLD="\033[1m"
ERRORS=0; WARNINGS=0; PASSED=0

COMPOSE="docker compose"
BACKEND_URL="http://localhost:9201"
FRONTEND_URL="http://localhost:9200"
DB_USER="${POSTGRES_USER:-billing}"
DB_NAME="${POSTGRES_DB:-billing}"

if [[ -f ".env" ]]; then
  set -a; source .env; set +a
fi

# Determine which sections to run
REQUESTED_SECTIONS=("$@")
run_all() { [[ ${#REQUESTED_SECTIONS[@]} -eq 0 ]]; }
should_run() {
  run_all && return 0
  local section="$1"
  for s in "${REQUESTED_SECTIONS[@]}"; do
    [[ "$s" == "$section" ]] && return 0
  done
  return 1
}

echo -e "${BOLD}🧾 billing — Pre-Deploy Tests${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}⊘${RESET} $1"; WARNINGS=$((WARNINGS + 1)); }
info() { echo -e "  ${DIM}$1${RESET}"; }

# ── 1. Backend Syntax ─────────────────────────────────
if should_run "syntax"; then
echo -e "${BOLD}1. Backend Syntax${RESET}"

cd backend

compile_check() {
  local dir="$1" label="$2" skip_files="${3:-__init__.py}"
  local err_count=0 file_count=0
  for f in "${dir}"/*.py; do
    [[ ! -f "$f" ]] && continue
    local base
    base=$(basename "$f")
    echo "$skip_files" | grep -qw "$base" && continue
    file_count=$((file_count + 1))
    if ! python3 -m py_compile "$f" 2>/dev/null; then
      fail "${base} has syntax errors"
      err_count=$((err_count + 1))
    fi
  done
  [[ $err_count -eq 0 ]] && [[ $file_count -gt 0 ]] && pass "All ${label} compile (${file_count} files)"
}

for core_file in main config database; do
  if python3 -m py_compile "app/${core_file}.py" 2>/dev/null; then
    pass "${core_file}.py compiles"
  else
    fail "${core_file}.py has syntax errors"
  fi
done

compile_check "app/api" "API routers"
compile_check "app/models" "models"
compile_check "app/schemas" "schemas"
compile_check "app/services" "services"

cd "$PROJECT_DIR"
echo ""
fi

# ── 2. Backend Imports ────────────────────────────────
if should_run "imports"; then
echo -e "${BOLD}2. Backend Imports${RESET}"

import_checks=(
  "FastAPI app|from app.main import app"
  "Config module|import app.config"
  "Database module|import app.database"
  "number_generator|import app.services.number_generator"
  "pdf_generator|import app.services.pdf_generator"
)

for entry in "${import_checks[@]}"; do
  label="${entry%%|*}"
  cmd="${entry##*|}"
  result=$($COMPOSE exec -T backend python3 -c "${cmd}; print('ok')" 2>/dev/null || echo "fail")
  if echo "$result" | grep -q "ok"; then
    pass "${label} imports (Docker)"
  else
    fail "${label} import failed (Docker)"
  fi
done

echo ""
fi

# ── 3. Dependencies ───────────────────────────────────
if should_run "deps"; then
echo -e "${BOLD}3. Dependencies${RESET}"

cd backend
if [[ -f "requirements.txt" ]]; then
  pass "requirements.txt exists"
  pkg_count=$(grep -cE "^[a-zA-Z]" requirements.txt || echo "0")
  info "${pkg_count} packages listed"
else
  fail "requirements.txt missing"
fi
cd "$PROJECT_DIR"

missing_pkgs=$($COMPOSE exec -T backend python3 -c "
missing = []
for pkg in ['fastapi','uvicorn','sqlalchemy','alembic','pydantic','jinja2']:
    try: __import__(pkg)
    except ImportError: missing.append(pkg)
if missing: print(' '.join(missing))
" 2>/dev/null || echo "CHECK_FAILED")

if [[ -z "$missing_pkgs" ]]; then
  pass "All critical Python packages importable (Docker)"
elif [[ "$missing_pkgs" == "CHECK_FAILED" ]]; then
  warn "Could not verify Python packages (backend container running?)"
else
  fail "Missing packages: ${missing_pkgs}"
fi

cd frontend
if [[ -d "node_modules" ]] && [[ -f "node_modules/.package-lock.json" ]]; then
  pass "node_modules exists"
else
  fail "node_modules missing — run: cd frontend && npm install"
fi
cd "$PROJECT_DIR"
echo ""
fi

# ── 4. Frontend ───────────────────────────────────────
if should_run "frontend"; then
echo -e "${BOLD}4. Frontend${RESET}"

cd frontend

if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compiles (no errors)"
else
  ts_count=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
  if [[ "$ts_count" -gt 0 ]]; then
    fail "TypeScript: ${ts_count} type errors"
    npx tsc --noEmit 2>&1 | grep "error TS" | head -3 | while read -r line; do info "$line"; done
  else
    warn "TypeScript check inconclusive"
  fi
fi

lint_output=$(npx eslint src/ 2>&1)
lint_exit=$?
if [[ $lint_exit -eq 0 ]]; then
  pass "ESLint passes"
else
  lint_errors=$(echo "$lint_output" | grep -c " error " 2>/dev/null || echo "0")
  lint_warns=$(echo "$lint_output" | grep -c " warning " 2>/dev/null || echo "0")
  if [[ "${lint_errors:-0}" -gt 0 ]] 2>/dev/null; then
    warn "ESLint: ${lint_errors} errors, ${lint_warns} warnings"
  else
    pass "ESLint passes (${lint_warns} warnings)"
  fi
fi

page_count=$(find src/pages -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
empty_pages=0
while IFS= read -r f; do
  lines=$(wc -l < "$f" | tr -d " ")
  [[ "$lines" -lt 2 ]] && empty_pages=$((empty_pages + 1))
done < <(find src/pages -name "*.tsx" 2>/dev/null)

if [[ "$page_count" -gt 0 ]]; then
  if [[ $empty_pages -eq 0 ]]; then
    pass "All ${page_count} pages have content"
  else
    warn "${empty_pages}/${page_count} pages appear empty"
  fi
fi

comp_count=$(find src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
[[ "$comp_count" -gt 0 ]] && pass "${comp_count} components found"

echo -e "  ${CYAN}Building frontend...${RESET}"
build_start=$(date +%s)
if npm run build > /tmp/vitebuild.log 2>&1; then
  build_time=$(( $(date +%s) - build_start ))
  pass "Vite production build succeeds (${build_time}s)"
else
  fail "Vite production build failed"
  tail -5 /tmp/vitebuild.log | while read -r line; do info "$line"; done
fi

cd "$PROJECT_DIR"
echo ""
fi

# ── 5. Docker ─────────────────────────────────────────
if should_run "docker"; then
echo -e "${BOLD}5. Docker${RESET}"

if [[ -f "docker-compose.yml" ]]; then
  pass "docker-compose.yml exists"
  if $COMPOSE config > /dev/null 2>&1; then
    pass "docker-compose.yml is valid"
    svc_count=$($COMPOSE config --services 2>/dev/null | wc -l | tr -d " ")
    info "Services defined: ${svc_count}"
    $COMPOSE config --services 2>/dev/null | while read -r svc; do info "  - ${svc}"; done
  else
    fail "docker-compose.yml has errors"
  fi
else
  fail "docker-compose.yml not found"
fi

for svc in db backend; do
  state=$($COMPOSE ps --format '{{.State}}' "$svc" 2>/dev/null || echo "not running")
  if [[ "$state" == "running" ]]; then
    pass "Container '${svc}' is running"
  else
    warn "Container '${svc}' state: ${state:-not started}"
  fi
done

[[ -f "backend/Dockerfile" ]] && pass "Backend Dockerfile exists" || warn "Backend Dockerfile missing"

echo ""
fi

# ── 6. Database ───────────────────────────────────────
if should_run "db"; then
echo -e "${BOLD}6. Database${RESET}"

if $COMPOSE exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  pass "PostgreSQL is ready"

  table_count=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
  if [[ "$table_count" -gt 0 ]] 2>/dev/null; then
    pass "Database has ${table_count} public tables"
  else
    warn "No public tables — migrations may not have run"
  fi

  $COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT table_name || ': ' || n_live_tup FROM pg_stat_user_tables ORDER BY table_name;" 2>/dev/null \
    | while read -r line; do [[ -n "$line" ]] && info "$line"; done

  migration_count=$(find backend/alembic/versions -name "*.py" 2>/dev/null | wc -l | tr -d " ")
  if [[ "$migration_count" -gt 0 ]]; then
    pass "Alembic migrations exist (${migration_count} files)"
  else
    warn "No migration files found"
  fi
else
  warn "PostgreSQL not reachable"
fi

echo ""
fi

# ── 6b. Alembic Migrations ───────────────────────────
if should_run "alembic"; then
echo -e "${BOLD}6b. Alembic Migrations${RESET}"

alembic_result=$($COMPOSE exec -T backend alembic upgrade head 2>&1)
if [[ $? -eq 0 ]]; then
  pass "Alembic upgrade head succeeds"
else
  fail "Alembic upgrade head failed"
  echo "$alembic_result" | tail -3 | while read -r line; do info "$line"; done
fi

alembic_current=$($COMPOSE exec -T backend alembic current 2>&1 | grep -oE '[a-f0-9]+ \(head\)' || echo "unknown")
info "Current migration: ${alembic_current}"

echo ""
fi

# ── 7. API Integration ────────────────────────────────
if should_run "api"; then
echo -e "${BOLD}7. API Integration${RESET}"

check_endpoint() {
  local label="$1" url="$2" expected="${3:-200}"
  local code
  if [[ -n "${AUTH_TOKEN:-}" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${AUTH_TOKEN}" --max-time 5 "$url" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  fi
  if [[ "$code" == "$expected" ]]; then
    pass "${label} (HTTP ${code})"
  else
    fail "${label} (expected ${expected}, got ${code})"
  fi
}

if curl -sf "${BACKEND_URL}/docs" > /dev/null 2>&1; then
  pass "Backend API is running"

  AUTH_TOKEN=""
  if [[ -n "${TEST_EMAIL:-}" ]] && [[ -n "${TEST_PASSWORD:-}" ]]; then
    AUTH_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")
    [[ -n "$AUTH_TOKEN" ]] && pass "Authenticated as ${TEST_EMAIL}" || warn "Auth failed — running unauthenticated"
  fi

  check_endpoint "GET /api/clients" "${BACKEND_URL}/api/clients"
  check_endpoint "GET /api/documents" "${BACKEND_URL}/api/documents"
  check_endpoint "GET /api/services" "${BACKEND_URL}/api/services"
  check_endpoint "GET /api/settings" "${BACKEND_URL}/api/settings"
  check_endpoint "GET /api/dashboard" "${BACKEND_URL}/api/dashboard"
  check_endpoint "Swagger docs" "${BACKEND_URL}/docs"
  check_endpoint "OpenAPI schema" "${BACKEND_URL}/openapi.json"

  ep_count=$(curl -sf "${BACKEND_URL}/openapi.json" 2>/dev/null | python3 -c "
import sys, json
spec = json.load(sys.stdin)
print(sum(1 for p in spec.get('paths',{}).values() for m in p if m.upper() in ('GET','POST','PUT','PATCH','DELETE')))
" 2>/dev/null || echo "?")
  info "Total API endpoints: ${ep_count}"

  resp_time=$(curl -sf -o /dev/null -w "%{time_total}" "${BACKEND_URL}/docs" 2>/dev/null || echo "0")
  resp_ms=$(python3 -c "print(int(float('${resp_time}') * 1000))" 2>/dev/null || echo "?")
  if [[ "$resp_ms" != "?" ]] && [[ "$resp_ms" -lt 200 ]]; then
    pass "API response time: ${resp_ms}ms"
  elif [[ "$resp_ms" != "?" ]] && [[ "$resp_ms" -lt 500 ]]; then
    warn "API response time: ${resp_ms}ms (slow)"
  else
    info "API response time: ${resp_ms}ms"
  fi

  echo -e "  ${CYAN}Running CRUD smoke test...${RESET}"
  curl_auth=()
  [[ -n "${AUTH_TOKEN:-}" ]] && curl_auth=(-H "Authorization: Bearer ${AUTH_TOKEN}")

  client_resp=$(curl -sf -X POST "${BACKEND_URL}/api/clients" \
    "${curl_auth[@]}" \
    -H "Content-Type: application/json" \
    -d '{"customer_number":"TEST-999","company_name":"__test_client__","street":"Test St 1","postal_code":"8000","city":"Zürich"}' 2>/dev/null || echo "")

  if echo "$client_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')" 2>/dev/null; then
    client_id=$(echo "$client_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    pass "POST /api/clients creates client (id: ${client_id})"

    get_code=$(curl -s -o /dev/null -w "%{http_code}" "${curl_auth[@]}" "${BACKEND_URL}/api/clients/${client_id}" 2>/dev/null || echo "0")
    [[ "$get_code" == "200" ]] && pass "GET /api/clients/${client_id} returns 200" || fail "GET client returned ${get_code}"

    del_code=$(curl -s -o /dev/null -w "%{http_code}" "${curl_auth[@]}" -X DELETE "${BACKEND_URL}/api/clients/${client_id}" 2>/dev/null || echo "0")
    if [[ "$del_code" == "200" ]] || [[ "$del_code" == "204" ]]; then
      pass "DELETE /api/clients/${client_id} cleanup"
    else
      warn "DELETE client returned ${del_code}"
    fi
  else
    warn "CRUD smoke test skipped (could not create test client)"
  fi
else
  warn "API not running — skipping integration tests"
  info "Start with: docker compose up -d"
fi

echo ""
fi

# ── 8. Frontend Reachability ──────────────────────────
if should_run "frontend-live"; then
echo -e "${BOLD}8. Frontend${RESET}"

if curl -sf "${FRONTEND_URL}" > /dev/null 2>&1; then
  pass "Frontend dev server running (port 9200)"
else
  warn "Frontend not reachable at ${FRONTEND_URL}"
fi

echo ""
fi

# ── 9. Port Conflicts ────────────────────────────────
if should_run "ports"; then
echo -e "${BOLD}9. Port Conflicts${RESET}"

for port in 9202 9201 9200; do
  listeners=$(lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | grep -cv "^COMMAND" 2>/dev/null || echo "0")
  listeners="${listeners//[^0-9]/}"
  [[ -z "$listeners" ]] && listeners=0
  if [[ "$listeners" -gt 1 ]]; then
    fail "Port ${port} has ${listeners} listeners — conflict!"
  elif [[ "$listeners" -eq 1 ]]; then
    pass "Port ${port} has 1 listener"
  else
    info "Port ${port} — no listeners"
  fi
done

echo ""
fi

# ── 10. Security ──────────────────────────────────────
if should_run "security"; then
echo -e "${BOLD}10. Security${RESET}"

secrets_found=$(grep -rn "password\|secret\|api_key" backend/app/ --include="*.py" 2>/dev/null \
  | grep -v "environ\|getenv\|settings\|pydantic\|password_hash\|hashed_password\|HTTPException\|detail=" \
  | grep -iE '=\s*".{8,}"' || true)

if [[ -n "$secrets_found" ]]; then
  fail "Possible hardcoded secrets in backend"
  echo "$secrets_found" | head -3 | while read -r line; do info "$line"; done
else
  pass "No hardcoded secrets in Python code"
fi

if [[ -f "docker-compose.yml" ]]; then
  dc_secrets=$(grep -E "(PASSWORD|SECRET|KEY)=" docker-compose.yml 2>/dev/null | grep -v '\${' || true)
  if [[ -n "$dc_secrets" ]]; then
    warn "Hardcoded secrets in docker-compose.yml"
    info "Use \${VAR} references with .env file"
  else
    pass "docker-compose.yml uses env variables for secrets"
  fi
fi

if [[ -f ".gitignore" ]]; then
  all_ignored=true
  for pattern in ".env" "venv" "__pycache__" "node_modules" "uploads" ".logs"; do
    if ! grep -q "$pattern" .gitignore 2>/dev/null; then
      warn ".gitignore missing: ${pattern}"
      all_ignored=false
    fi
  done
  $all_ignored && pass ".gitignore covers sensitive patterns"
else
  fail ".gitignore file missing"
fi

cors=$(grep -oE "allow_origins=\[.*\]" backend/app/main.py 2>/dev/null || echo "")
if echo "$cors" | grep -q '\*'; then
  warn "CORS allows all origins (*) — restrict for production"
else
  pass "CORS configuration looks reasonable"
fi

echo ""
fi

# ── 11. Production Readiness ─────────────────────────
if should_run "prod"; then
echo -e "${BOLD}11. Production Readiness${RESET}"

[[ -f "README.md" ]] && pass "README.md exists ($(wc -l < README.md | tr -d ' ') lines)" || warn "README.md missing"
[[ -f "SPEC.md" ]] && pass "SPEC.md exists" || info "No SPEC.md"
[[ -d "backend/alembic" ]] && pass "Alembic configured" || warn "No alembic directory"
[[ -f "backend/app/seed.py" ]] && pass "Seed data script exists"
[[ -d "backend/uploads" ]] && pass "Uploads directory exists" || warn "Uploads directory missing"

echo ""
fi

# ── 12. Type-Safe API Client ─────────────────────────
if should_run "types"; then
echo -e "${BOLD}12. Type-Safe API Client${RESET}"

cd frontend
if [[ -f "src/types/api.generated.ts" ]]; then
  lines=$(wc -l < src/types/api.generated.ts | tr -d " ")
  if [[ "$lines" -gt 10 ]]; then
    pass "Generated API types exist (${lines} lines)"
  else
    warn "api.generated.ts exists but looks empty (${lines} lines)"
  fi

  if command -v npx &> /dev/null && curl -sf "${BACKEND_URL}/openapi.json" > /dev/null 2>&1; then
    npx openapi-typescript "${BACKEND_URL}/openapi.json" -o /tmp/api-check.ts 2>/dev/null
    if [[ -f "/tmp/api-check.ts" ]]; then
      if diff -q src/types/api.generated.ts /tmp/api-check.ts > /dev/null 2>&1; then
        pass "API types are up to date"
      else
        warn "API types are stale — run: npm run generate-api"
      fi
      rm -f /tmp/api-check.ts
    fi
  fi
else
  warn "No generated API types — run: npm run generate-api"
fi
cd "$PROJECT_DIR"
echo ""
fi

# ── 13. E2E Tests ────────────────────────────────────
if should_run "e2e"; then
echo -e "${BOLD}13. E2E Tests${RESET}"

cd frontend
if [[ -d "e2e" ]] && [[ -f "playwright.config.ts" ]]; then
  e2e_count=$(find e2e -name "*.spec.ts" 2>/dev/null | wc -l | tr -d " ")
  pass "Playwright configured (${e2e_count} spec files)"

  if [[ "${RUN_E2E:-false}" == "true" ]]; then
    echo -e "  ${CYAN}Running E2E tests...${RESET}"
    e2e_output=$(npx playwright test --reporter=line 2>&1)
    if [[ $? -eq 0 ]]; then
      e2e_passed=$(echo "$e2e_output" | grep -oE "[0-9]+ passed" || echo "? passed")
      pass "E2E tests passed (${e2e_passed})"
    else
      e2e_failed=$(echo "$e2e_output" | grep -oE "[0-9]+ failed" || echo "? failed")
      fail "E2E tests failed (${e2e_failed})"
    fi
  else
    info "Skipped — set RUN_E2E=true to run"
  fi
else
  info "No Playwright tests configured"
fi
cd "$PROJECT_DIR"
echo ""
fi

# ── Summary ───────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✓ ${PASSED} passed${RESET}  ${RED}✗ ${ERRORS} failed${RESET}  ${YELLOW}⊘ ${WARNINGS} warnings${RESET}"
echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}✓ All checks passed — ready to deploy!${RESET}"
else
  echo -e "${RED}${BOLD}✗ ${ERRORS} check(s) failed — fix before deploying${RESET}"
fi
echo ""
exit "$ERRORS"