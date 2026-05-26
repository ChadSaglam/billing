#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
[[ -f .env ]] || { echo ".env missing"; exit 1; }

DB_INFO="$(python3 - <<'PY'
from urllib.parse import urlparse
from pathlib import Path

env = {}
for line in Path(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    env[key.strip()] = value.strip()

url = env.get("DATABASE_URL", "")
if not url:
    raise SystemExit("DATABASE_URL missing in .env")

parsed = urlparse(url)
host = parsed.hostname or "localhost"
port = parsed.port or 5432
user = parsed.username or ""
dbname = parsed.path.lstrip("/")

print(host)
print(port)
print(user)
print(dbname)
print(url)
PY
)"

DB_HOST="$(printf '%s\n' "$DB_INFO" | sed -n '1p')"
DB_PORT="$(printf '%s\n' "$DB_INFO" | sed -n '2p')"
DB_USER="$(printf '%s\n' "$DB_INFO" | sed -n '3p')"
DB_NAME="$(printf '%s\n' "$DB_INFO" | sed -n '4p')"
DB_URL="$(printf '%s\n' "$DB_INFO" | sed -n '5p')"

echo "Checking PostgreSQL on ${DB_HOST}:${DB_PORT} ..."
pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"

echo "Checking database '${DB_NAME}' ..."
psql "$DB_URL" -tAc "SELECT current_database();" >/dev/null

echo "Database is reachable"