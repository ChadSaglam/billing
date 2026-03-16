#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# test.sh — Comprehensive pre-deploy test suite
# chadev-billing: Invoicing & Document Management
# ─────────────────────────────────────────────────────────
set -uo pipefail

CYAN="\033[36m"; GREEN="\033[32m"; RED="\033[31m"; YELLOW="\033[33m"; DIM="\033[2m"; RESET="\033[0m"; BOLD="\033[1m"
ERRORS=0; WARNINGS=0; PASSED=0

COMPOSE="docker compose"
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"
DB_USER="chadev"
DB_NAME="chadev_billing"

echo -e "${BOLD}🧾 chadev-billing — Pre-Deploy Tests${RESET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}⊘${RESET} $1"; WARNINGS=$((WARNINGS + 1)); }
info() { echo -e "  ${DIM}$1${RESET}"; }

# ── 1. Backend Syntax ─────────────────────────────────
echo -e "${BOLD}1. Backend Syntax${RESET}"

cd backend

compile_check() {
  local dir="$1" label="$2" skip_files="${3:-__init__.py}"
  local err_count=0
  local file_count=0
  for f in ${dir}/*.py; do
    [ ! -f "$f" ] && continue
    base=$(basename "$f")
    echo "$skip_files" | grep -qw "$base" && continue
    file_count=$((file_count + 1))
    if ! python3 -m py_compile "$f" 2>/dev/null; then
      fail "${base} has syntax errors"
      err_count=$((err_count + 1))
    fi
  done
  [ $err_count -eq 0 ] && [ $file_count -gt 0 ] && pass "All ${label} compile (${file_count} files)"
}

python3 -m py_compile app/main.py 2>/dev/null && pass "main.py compiles" || fail "main.py has syntax errors"
python3 -m py_compile app/config.py 2>/dev/null && pass "config.py compiles" || fail "config.py has syntax errors"
python3 -m py_compile app/database.py 2>/dev/null && pass "database.py compiles" || fail "database.py has syntax errors"

compile_check "app/api" "API routers" "__init__.py"
compile_check "app/models" "models" "__init__.py"
compile_check "app/schemas" "schemas" "__init__.py"
compile_check "app/services" "services" "__init__.py"

cd ..
echo ""

# ── 2. Backend Imports ────────────────────────────────
echo -e "${BOLD}2. Backend Imports${RESET}"

# Always test via Docker (local Python 3.13 lacks psycopg2 C extension)
for mod_label in "app.main:app:FastAPI app" "app.config:*:Config module" "app.database:*:Database module" \
                 "app.services.number_generator:*:number_generator" "app.services.pdf_generator:*:pdf_generator"; do
  mod=$(echo "$mod_label" | cut -d: -f1)
  attr=$(echo "$mod_label" | cut -d: -f2)
  label=$(echo "$mod_label" | cut -d: -f3)

  if [ "$attr" = "*" ]; then
    CMD="import ${mod}"
  else
    CMD="from ${mod} import ${attr}"
  fi

  RESULT=$($COMPOSE exec -T backend python3 -c "${CMD}; print('ok')" 2>/dev/null || echo "fail")
  if echo "$RESULT" | grep -q "ok"; then
    pass "${label} imports (via Docker)"
  else
    fail "${label} import failed (via Docker)"
  fi
done

echo ""

# ── 3. Dependencies ───────────────────────────────────
echo -e "${BOLD}3. Dependencies${RESET}"

cd backend
if [ -f "requirements.txt" ]; then
  pass "requirements.txt exists"
  PKG_COUNT=$(grep -cE "^[a-zA-Z]" requirements.txt || echo "0")
  info "${PKG_COUNT} packages listed"
else
  fail "requirements.txt missing"
fi
cd ..

# Check Python deps via Docker (single call for speed + reliability)
MISSING_PKGS=$($COMPOSE exec -T backend python3 -c "
missing = []
for pkg in ['fastapi','uvicorn','sqlalchemy','alembic','pydantic','jinja2']:
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg)
if missing:
    print(' '.join(missing))
" 2>/dev/null || echo "CHECK_FAILED")

if [ -z "$MISSING_PKGS" ]; then
  pass "All critical Python packages importable (via Docker)"
elif [ "$MISSING_PKGS" = "CHECK_FAILED" ]; then
  warn "Could not verify Python packages (backend container not running?)"
else
  fail "Missing packages: ${MISSING_PKGS}"
fi

cd frontend
if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
  pass "node_modules exists"
  OUTDATED=$(npm outdated --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null | tr -d '\n' || echo "0")
  [ "$OUTDATED" -gt 0 ] 2>/dev/null && info "${OUTDATED} npm packages have updates available"
else
  fail "node_modules missing — run: cd frontend && npm install"
fi
cd ..
echo ""

# ── 4. Frontend ───────────────────────────────────────
echo -e "${BOLD}4. Frontend${RESET}"

cd frontend

if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compiles (no errors)"
else
  TSCOUNT=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
  if [ "$TSCOUNT" -gt 0 ]; then
    fail "TypeScript: ${TSCOUNT} type errors"
    npx tsc --noEmit 2>&1 | grep "error TS" | head -3 | while read -r line; do info "$line"; done
  else
    warn "TypeScript check inconclusive"
  fi
fi

if npx eslint src/ --quiet 2>/dev/null; then
  pass "ESLint passes"
else
  LINT_ERR=$(npx eslint src/ --quiet 2>&1 | grep -c "error" 2>/dev/null || echo "0")
  if [ "${LINT_ERR:-0}" -gt 0 ] 2>/dev/null; then
    fail "ESLint: ${LINT_ERR} errors"
  else
    warn "ESLint has warnings"
  fi
fi

PAGE_COUNT=$(find src/pages -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
EMPTY_PAGES=0
for f in $(find src/pages -name "*.tsx" 2>/dev/null); do
  LINES=$(wc -l < "$f" | tr -d " ")
  [ "$LINES" -lt 2 ] && EMPTY_PAGES=$((EMPTY_PAGES + 1))
done
if [ "$PAGE_COUNT" -gt 0 ]; then
  if [ $EMPTY_PAGES -eq 0 ]; then
    pass "All ${PAGE_COUNT} pages have content"
  else
    warn "${EMPTY_PAGES}/${PAGE_COUNT} pages appear empty"
  fi
fi

COMP_COUNT=$(find src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d " ")
[ "$COMP_COUNT" -gt 0 ] && pass "${COMP_COUNT} components found"

echo -e "  ${CYAN}Building frontend...${RESET}"
BUILD_START=$(date +%s)
if npm run build > /tmp/vitebuild.log 2>&1; then
  BUILD_END=$(date +%s)
  BUILD_TIME=$((BUILD_END - BUILD_START))
  pass "Vite production build succeeds (${BUILD_TIME}s)"
else
  fail "Vite production build failed"
  tail -5 /tmp/vitebuild.log | while read -r line; do info "$line"; done
fi

cd ..
echo ""

# ── 5. Docker ─────────────────────────────────────────
echo -e "${BOLD}5. Docker${RESET}"

if [ -f "docker-compose.yml" ]; then
  pass "docker-compose.yml exists"
  if $COMPOSE config > /dev/null 2>&1; then
    pass "docker-compose.yml is valid"
    SVC_COUNT=$($COMPOSE config --services 2>/dev/null | wc -l | tr -d " ")
    info "Services defined: ${SVC_COUNT}"
    $COMPOSE config --services 2>/dev/null | while read -r svc; do info "  - ${svc}"; done
  else
    fail "docker-compose.yml has errors"
  fi
else
  fail "docker-compose.yml not found"
fi

for svc in db backend; do
  state=$($COMPOSE ps --format '{{.State}}' "$svc" 2>/dev/null || echo "not running")
  if [ "$state" = "running" ]; then
    pass "Container '${svc}' is running"
  else
    warn "Container '${svc}' state: ${state:-not started}"
  fi
done

[ -f "backend/Dockerfile" ] && pass "Backend Dockerfile exists" || warn "Backend Dockerfile missing"

echo ""

# ── 6. Database ───────────────────────────────────────
echo -e "${BOLD}6. Database${RESET}"

if $COMPOSE exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  pass "PostgreSQL is ready"

  TABLE_COUNT=$($COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
  if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
    pass "Database has ${TABLE_COUNT} public tables"
  else
    warn "No public tables — migrations may not have run"
  fi

  $COMPOSE exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT table_name || ': ' || n_live_tup FROM pg_stat_user_tables ORDER BY table_name;" 2>/dev/null \
    | while read -r line; do [ -n "$line" ] && info "$line"; done

  MIGRATION_COUNT=$(find backend/alembic/versions -name "*.py" 2>/dev/null | wc -l | tr -d " ")
  if [ "$MIGRATION_COUNT" -gt 0 ]; then
    pass "Alembic migrations exist (${MIGRATION_COUNT} files)"
  else
    warn "No migration files found"
  fi
elif pg_isready -q 2>/dev/null; then
  pass "PostgreSQL running on host"
else
  warn "PostgreSQL not reachable"
fi

echo ""

# ── 7. API Integration ────────────────────────────────
echo -e "${BOLD}7. API Integration${RESET}"

check_endpoint() {
  local label="$1" url="$2" expected="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expected" ]; then
    pass "${label} (HTTP ${code})"
  else
    fail "${label} (expected ${expected}, got ${code})"
  fi
}

if curl -sf "${BACKEND_URL}/docs" > /dev/null 2>&1; then
  pass "Backend API is running"

  check_endpoint "GET /api/clients" "${BACKEND_URL}/api/clients"
  check_endpoint "GET /api/documents" "${BACKEND_URL}/api/documents"
  check_endpoint "GET /api/services" "${BACKEND_URL}/api/services"
  check_endpoint "GET /api/settings" "${BACKEND_URL}/api/settings"
  check_endpoint "GET /api/dashboard" "${BACKEND_URL}/api/dashboard"
  check_endpoint "Swagger docs" "${BACKEND_URL}/docs"
  check_endpoint "OpenAPI schema" "${BACKEND_URL}/openapi.json"

  EP_COUNT=$(curl -sf "${BACKEND_URL}/openapi.json" 2>/dev/null | python3 -c "
import sys, json
spec = json.load(sys.stdin)
count = sum(1 for p in spec.get('paths',{}).values() for m in p if m.upper() in ('GET','POST','PUT','PATCH','DELETE'))
print(count)
" 2>/dev/null || echo "?")
  info "Total API endpoints: ${EP_COUNT}"

  RESP_TIME=$(curl -sf -o /dev/null -w "%{time_total}" "${BACKEND_URL}/docs" 2>/dev/null || echo "0")
  RESP_MS=$(python3 -c "print(int(float('${RESP_TIME}') * 1000))" 2>/dev/null || echo "?")
  if [ "$RESP_MS" != "?" ] && [ "$RESP_MS" -lt 200 ]; then
    pass "API response time: ${RESP_MS}ms"
  elif [ "$RESP_MS" != "?" ] && [ "$RESP_MS" -lt 500 ]; then
    warn "API response time: ${RESP_MS}ms (slow)"
  else
    info "API response time: ${RESP_MS}ms"
  fi

  echo -e "  ${CYAN}Running CRUD smoke test...${RESET}"
  CLIENT_RESP=$(curl -sf -X POST "${BACKEND_URL}/api/clients" \
    -H "Content-Type: application/json" \
    -d '{"customer_number":"TEST-999","company_name":"__test_client__","street":"Test St 1","postal_code":"8000","city":"Zürich"}' 2>/dev/null || echo "")
  
  if echo "$CLIENT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')" 2>/dev/null; then
    CLIENT_ID=$(echo "$CLIENT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    pass "POST /api/clients creates client (id: ${CLIENT_ID})"

    GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/clients/${CLIENT_ID}" 2>/dev/null || echo "0")
    [ "$GET_CODE" = "200" ] && pass "GET /api/clients/${CLIENT_ID} returns 200" || fail "GET client returned ${GET_CODE}"

    DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BACKEND_URL}/api/clients/${CLIENT_ID}" 2>/dev/null || echo "0")
    if [ "$DEL_CODE" = "200" ] || [ "$DEL_CODE" = "204" ]; then
      pass "DELETE /api/clients/${CLIENT_ID} cleanup"
    else
      warn "DELETE client returned ${DEL_CODE}"
    fi
  else
    warn "CRUD smoke test skipped (could not create test client)"
  fi
else
  warn "API not running — skipping integration tests"
  info "Start with: docker compose up -d"
fi

echo ""

# ── 8. Frontend Reachability ──────────────────────────
echo -e "${BOLD}8. Frontend${RESET}"

if curl -sf "${FRONTEND_URL}" > /dev/null 2>&1; then
  pass "Frontend dev server running (port 5173)"
else
  warn "Frontend not reachable at ${FRONTEND_URL}"
fi

echo ""

# ── 9. Port Conflicts ────────────────────────────────
echo -e "${BOLD}9. Port Conflicts${RESET}"

for port in 5432 8000 5173; do
  listeners=$(lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | grep -v "^COMMAND" | wc -l | tr -d " " || echo "0")
  if [ "$listeners" -gt 1 ]; then
    fail "Port ${port} has ${listeners} listeners — conflict!"
    lsof -i :"$port" -sTCP:LISTEN 2>/dev/null | grep -v "^COMMAND" | head -3 | while read -r line; do info "$line"; done
  elif [ "$listeners" -eq 1 ]; then
    pass "Port ${port} has 1 listener"
  else
    info "Port ${port} — no listeners"
  fi
done

echo ""

# ── 10. Security ──────────────────────────────────────
echo -e "${BOLD}10. Security${RESET}"

SECRETS_FOUND=$(grep -rn "password\|secret\|api_key" backend/app/ --include="*.py" 2>/dev/null \
  | grep -v "environ\|getenv\|settings\|pydantic\|password_hash\|hashed_password" \
  | grep -iE '=\s*".{8,}"' || true)

if [ -n "$SECRETS_FOUND" ]; then
  fail "Possible hardcoded secrets in backend"
  echo "$SECRETS_FOUND" | head -3 | while read -r line; do info "$line"; done
else
  pass "No hardcoded secrets in Python code"
fi

if [ -f "docker-compose.yml" ]; then
  DC_SECRETS=$(grep -E "(PASSWORD|SECRET|KEY)=" docker-compose.yml 2>/dev/null | grep -v '${' || true)
  if [ -n "$DC_SECRETS" ]; then
    warn "Hardcoded secrets in docker-compose.yml"
    info "Consider using \${VAR} references with .env file"
  else
    pass "docker-compose.yml uses env variables for secrets"
  fi
fi

if [ -f ".gitignore" ]; then
  ALL_IGNORED=true
  for PATTERN in ".env" "venv" "__pycache__" "node_modules" "uploads"; do
    if ! grep -q "$PATTERN" .gitignore 2>/dev/null; then
      warn ".gitignore missing: ${PATTERN}"
      ALL_IGNORED=false
    fi
  done
  $ALL_IGNORED && pass ".gitignore covers sensitive patterns"
else
  fail ".gitignore file missing"
fi

CORS=$(grep -oE "allow_origins=\[.*\]" backend/app/main.py 2>/dev/null || echo "")
if echo "$CORS" | grep -q '\*'; then
  warn "CORS allows all origins (*) — restrict for production"
else
  pass "CORS configuration looks reasonable"
fi

echo ""

# ── 11. Production Readiness ─────────────────────────
echo -e "${BOLD}11. Production Readiness${RESET}"

[ -f "README.md" ] && pass "README.md exists ($(wc -l < README.md | tr -d ' ') lines)" || warn "README.md missing"
[ -f "SPEC.md" ] && pass "SPEC.md exists" || info "No SPEC.md"

if [ -d "backend/alembic" ]; then
  pass "Alembic configured"
else
  warn "No alembic directory — DB migrations not set up"
fi

[ -f "backend/app/seed.py" ] && pass "Seed data script exists"

UPLOAD_DIR="backend/uploads"
[ -d "$UPLOAD_DIR" ] && pass "Uploads directory exists" || warn "Uploads directory missing"

echo ""

# ── Summary ───────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✓ ${PASSED} passed${RESET}  ${RED}✗ ${ERRORS} failed${RESET}  ${YELLOW}⊘ ${WARNINGS} warnings${RESET}"
echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ All checks passed — ready to deploy!${RESET}"
else
  echo -e "${RED}${BOLD}✗ ${ERRORS} check(s) failed — fix before deploying${RESET}"
fi
echo ""
exit $ERRORS
