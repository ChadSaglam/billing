#!/usr/bin/env bash
set -euo pipefail

CLIENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$CLIENT_DIR/runtime"
mkdir -p "$RUNTIME_DIR"

# Project root = three levels up from this client's directory
PROJECT_ROOT="$(cd "$CLIENT_DIR/../../.." && pwd)"
MASTER="$PROJECT_ROOT/scripts/provision.sh"

# ── Client‑specific settings ──────────────────────────────
CLIENT_NAME="ChaDev"
CLIENT_SLUG="billing"
ADMIN_EMAIL="info@chadev.ch"
ADMIN_PASSWORD="Sahra/2202"

# Auto‑detect Docker availability
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    DEPLOY_MODE="docker"
else
    echo "Docker not available, falling back to local mode"
    DEPLOY_MODE="local"
fi

# Port preferences – local uses 8002, docker uses 8001
if [[ "$DEPLOY_MODE" == "docker" ]]; then
    BASE_BACKEND_PORT=8001
else
    BASE_BACKEND_PORT=8002
fi
BASE_FRONTEND_PORT=5173
BASE_DB_PORT=5434

# Logo & seed files
SEED_FILE="$CLIENT_DIR/seed.json"
LOGO_FILE="$CLIENT_DIR/logo.png"

TENANT_ID=1

exec "$MASTER" \
    --client-name "$CLIENT_NAME" \
    --client-slug "$CLIENT_SLUG" \
    --tenant-id "$TENANT_ID" \
    --admin-email "$ADMIN_EMAIL" \
    --admin-password "$ADMIN_PASSWORD" \
    --mode "$DEPLOY_MODE" \
    --db-port "$BASE_DB_PORT" \
    --backend-port "$BASE_BACKEND_PORT" \
    --frontend-port "$BASE_FRONTEND_PORT" \
    --seed-file "$SEED_FILE" \
    --logo-file "$LOGO_FILE"

echo ""
echo "To use this client in your default local-dev environment:"
echo "  1. Stop this client (Ctrl+C)"
echo "  2. Run:  ./scripts/local-dev.sh"