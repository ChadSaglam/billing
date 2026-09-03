#!/usr/bin/env sh
# Alembic owns the schema (R-10), so migrations must run before the app
# accepts traffic — nothing creates tables at startup any more.
set -e

echo "[entrypoint] applying migrations..."
alembic upgrade head

echo "[entrypoint] starting uvicorn on :8000 (APP_ENV=${APP_ENV:-development})"
if [ "${APP_ENV}" = "production" ]; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
else
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi
