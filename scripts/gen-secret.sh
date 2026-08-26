#!/usr/bin/env bash
# Generate secrets into .env.
#
#   ./scripts/gen-secret.sh            fill only empty values
#   ./scripts/gen-secret.sh --rotate   replace values even if already set
#
# Use --rotate after a leak. Rotating SECRET_KEY invalidates every existing
# login token, which is the point.
#
# Compatible with bash 3.2 (the /bin/bash macOS ships).
set -eu
cd "$(dirname "$0")/.."

ROTATE=0
[ "${1:-}" = "--rotate" ] && ROTATE=1

[ -f .env ] || { echo "No .env — run: cp .env.example .env"; exit 1; }

# BSD sed (macOS) and GNU sed disagree about -i. This works on both.
sed_i() {
  sed -i.scrubbak "$1" .env && rm -f .env.scrubbak
}

# `|` as the delimiter, and the replacement is escaped, so generated values
# containing / or & can't corrupt the file.
escape_repl() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

set_key() {
  key="$1"; value="$2"
  esc=$(escape_repl "$value")
  if grep -qE "^${key}=$" .env; then
    sed_i "s|^${key}=$|${key}=${esc}|"
    echo "  set ${key}"
  elif [ "$ROTATE" -eq 1 ] && grep -qE "^${key}=" .env; then
    sed_i "s|^${key}=.*|${key}=${esc}|"
    echo "  ROTATED ${key}"
  elif grep -qE "^${key}=" .env; then
    echo "  ${key} already set — skipped (use --rotate to replace)"
  else
    printf '%s=%s\n' "$key" "$value" >> .env
    echo "  added ${key}"
  fi
}

if [ "$ROTATE" -eq 1 ]; then
  echo "ROTATING secrets in .env (old values become invalid):"
else
  echo "Filling empty secrets in .env:"
fi

NEW_SECRET_KEY="$(openssl rand -hex 32)"
NEW_DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"

set_key SECRET_KEY "$NEW_SECRET_KEY"
set_key POSTGRES_PASSWORD "$NEW_DB_PASSWORD"

# Keep DATABASE_URL's password in sync with POSTGRES_PASSWORD.
if [ "$ROTATE" -eq 1 ] && grep -qE '^DATABASE_URL=.+://[^:/]+:[^@]+@' .env; then
  DB_USER=$(grep -E '^DATABASE_URL=' .env | sed -E 's|^DATABASE_URL=.*://([^:/]+):.*|\1|')
  esc=$(escape_repl "$NEW_DB_PASSWORD")
  sed_i "s|^\(DATABASE_URL=.*://[^:/]*:\)[^@]*\(@.*\)|\1${esc}\2|"
  echo "  ROTATED DATABASE_URL password"
  echo
  echo "Now change it on the database itself, or logins will fail:"
  echo "    psql -c \"ALTER USER ${DB_USER} WITH PASSWORD '${NEW_DB_PASSWORD}';\""
  echo "  (Docker: docker compose down -v && docker compose up --build"
  echo "   recreates the volume with the new password.)"
fi

echo
if [ "$ROTATE" -eq 1 ]; then
  echo "Done. Everyone is logged out — that is expected after a key rotation."
else
  echo "Done. If DATABASE_URL still says CHANGE_ME, paste POSTGRES_PASSWORD into it."
fi
