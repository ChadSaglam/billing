#!/usr/bin/env sh
# Alembic owns the schema (R-10), so migrations must run before the app
# accepts traffic — nothing creates tables at startup any more.
set -e

echo "[entrypoint] user=$(id -un) uid=$(id -u) cwd=$(pwd)"
echo "[entrypoint] APP_ENV=${APP_ENV:-development}"

# The uploads volume is mounted over the image directory, so its ownership
# comes from the volume, not the image. Fail loudly here rather than at the
# first import inside the app.
if [ ! -w /app/uploads ]; then
  echo "[entrypoint] FATAL: /app/uploads is not writable by $(id -un)" >&2
  ls -ld /app/uploads >&2
  exit 1
fi
mkdir -p /app/uploads/logos

echo "[entrypoint] applying migrations..."
if ! alembic upgrade head; then
  echo "[entrypoint] FATAL: alembic upgrade head failed" >&2
  exit 1
fi
alembic current

echo "[entrypoint] starting uvicorn on :8000"
if [ "${APP_ENV}" = "production" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
else
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
