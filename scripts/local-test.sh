#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_PORT="${BACKEND_PORT:-9201}"
FRONTEND_PORT="${FRONTEND_PORT:-9200}"
BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

cd "$PROJECT_DIR"
[[ -f .env ]] || { echo ".env missing"; exit 1; }

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

pass() { echo -e "${GREEN}PASS${RESET} $1"; }
warn() { echo -e "${YELLOW}WARN${RESET} $1"; }
fail() { echo -e "${RED}FAIL${RESET} $1"; exit 1; }

read_env() {
  python3 - <<'PY'
from pathlib import Path
env = {}
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key.strip()] = value.strip()
print(env.get("TEST_EMAIL", ""))
print(env.get("TEST_PASSWORD", ""))
PY
}

ENV_DATA="$(read_env)"
TEST_EMAIL="$(printf '%s\n' "$ENV_DATA" | sed -n '1p')"
TEST_PASSWORD="$(printf '%s\n' "$ENV_DATA" | sed -n '2p')"

echo "Running local checks..."

python3 -m py_compile backend/app/main.py && pass "backend/app/main.py compiles" || fail "backend/app/main.py compile failed"
python3 -m py_compile backend/app/config.py && pass "backend/app/config.py compiles" || fail "backend/app/config.py compile failed"
python3 -m py_compile backend/app/database.py && pass "backend/app/database.py compiles" || fail "backend/app/database.py compile failed"

./scripts/local-db-check.sh && pass "database reachable" || fail "database not reachable"

curl -sf "$BACKEND_URL/api/health" >/dev/null && pass "backend health endpoint reachable" || warn "backend health endpoint not reachable"
curl -sf "$BACKEND_URL/docs" >/dev/null && pass "backend docs reachable" || warn "backend docs not reachable"
curl -sf "$BACKEND_URL/openapi.json" >/dev/null && pass "OpenAPI reachable" || warn "OpenAPI not reachable"
curl -sf "$FRONTEND_URL" >/dev/null && pass "frontend reachable" || warn "frontend not reachable"

if [[ -n "$TEST_EMAIL" && -n "$TEST_PASSWORD" ]]; then
  LOGIN_RESPONSE="$(
    curl -s -X POST "$BACKEND_URL/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
  )"

  AUTH_TOKEN="$(
    python3 -c 'import json, sys
raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    data = json.loads(raw) if raw else {}
except json.JSONDecodeError:
    data = {}
print(data.get("access_token", ""))' "$LOGIN_RESPONSE"
  )"

  if [[ -n "$AUTH_TOKEN" ]]; then
    pass "login works with TEST_EMAIL"
    curl -sf -H "Authorization: Bearer $AUTH_TOKEN" "$BACKEND_URL/api/clients" >/dev/null \
      && pass "authorized /api/clients works" \
      || warn "authorized /api/clients failed"
  else
    warn "login failed with TEST_EMAIL"
    [[ -n "$LOGIN_RESPONSE" ]] && echo "Login response: $LOGIN_RESPONSE"
  fi
else
  warn "TEST_EMAIL / TEST_PASSWORD not set"
fi

(cd frontend && npx tsc --noEmit >/dev/null 2>&1) && pass "frontend TypeScript check passed" || warn "frontend TypeScript check failed"

echo "Local checks finished"