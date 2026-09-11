#!/usr/bin/env bash
# e2e.sh — run the Playwright suite against a throw-away API on the e2e ports.
#
#   make test-e2e            # = ./scripts/e2e.sh
#   ./scripts/e2e.sh --ui    # extra args go to `playwright test`
#
# The API listens on 9100 with its own database `billing_e2e`, derived from the
# same Postgres the dev stack uses (POSTGRES_USER/PASSWORD/DB_PORT in .env,
# i.e. the Docker db on 9432) — E2E_DATABASE_URL overrides. If something is
# already listening on 9100 it is reused and left alone (same as playwright's
# reuseExistingServer for the frontend).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${E2E_API_PORT:-9100}"
PY="$ROOT/backend/venv/bin/python"
[[ -x "$PY" ]] || PY="$(command -v python3)"

envget() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }

if [[ -z "${E2E_DATABASE_URL:-}" ]]; then
  user="$(envget POSTGRES_USER)"; pw="$(envget POSTGRES_PASSWORD)"; port="$(envget DB_PORT)"
  if [[ -n "$user" && -n "$port" ]]; then
    E2E_DATABASE_URL="postgresql://${user}:${pw}@127.0.0.1:${port}/billing_e2e"
  else
    E2E_DATABASE_URL="postgresql://postgres@127.0.0.1:5433/billing_e2e"
  fi
fi

listening() { (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

started=""
if listening "$API_PORT"; then
  echo "→ API already on :$API_PORT — reusing it"
else
  echo "→ database $E2E_DATABASE_URL"
  "$PY" - "$E2E_DATABASE_URL" <<'PY'
import sys, psycopg2
from urllib.parse import urlsplit, urlunsplit
url = urlsplit(sys.argv[1]); name = url.path.lstrip("/")
admin = urlunsplit(url._replace(path="/postgres"))
conn = psycopg2.connect(admin); conn.autocommit = True
with conn.cursor() as c:
    c.execute(f'DROP DATABASE IF EXISTS "{name}"')
    c.execute(f'CREATE DATABASE "{name}"')
conn.close()
PY
  (cd "$ROOT/backend" && DATABASE_URL="$E2E_DATABASE_URL" SECRET_KEY=e2e "$PY" -m alembic upgrade head >/dev/null)
  echo "→ API on :$API_PORT (log: frontend/test-results/api.log)"
  mkdir -p "$ROOT/frontend/test-results"
  env -C "$ROOT/backend" DATABASE_URL="$E2E_DATABASE_URL" SECRET_KEY=e2e APP_ENV=test RUN_JOBS_IN_API=false \
    ALLOWED_ORIGINS="http://localhost:${E2E_FRONTEND_PORT:-5150},http://127.0.0.1:${E2E_FRONTEND_PORT:-5150}" \
    "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" --log-level warning >"$ROOT/frontend/test-results/api.log" 2>&1 &
  started=$!
  trap '[[ -n "$started" ]] && kill "$started" 2>/dev/null || true' EXIT
  for _ in $(seq 1 60); do listening "$API_PORT" && break; sleep 0.5; done
  listening "$API_PORT" || { echo "✘ API did not start on :$API_PORT"; exit 1; }
fi

cd "$ROOT/frontend" && E2E_API_URL="http://localhost:$API_PORT" npx playwright test "$@"
