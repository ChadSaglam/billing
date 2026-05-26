#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BOLD="\033[1m"
RESET="\033[0m"

ok() { echo -e "${GREEN}$1${RESET}"; }
warn() { echo -e "${YELLOW}$1${RESET}"; }
fail() { echo -e "${RED}$1${RESET}"; exit 1; }

require_cmd() {
  local cmd="$1"
  local hint="$2"
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd not found. $hint"
}

echo -e "${BOLD}chadev-billing local setup${RESET}"

require_cmd python3 "Install Python 3.12+"
require_cmd node "Install Node.js"
require_cmd npm "Install npm"
require_cmd psql "Install PostgreSQL client tools"
require_cmd pg_isready "Install PostgreSQL client tools"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  warn ".env not found in project root"
  warn "Create it before running local-dev.sh"
else
  ok ".env found"
fi

mkdir -p "$BACKEND_DIR/uploads"
mkdir -p "$BACKEND_DIR/uploads/logos"
ok "Upload directories ready"

if [[ ! -d "$BACKEND_DIR/venv" ]]; then
  python3 -m venv "$BACKEND_DIR/venv"
  ok "Created backend virtual environment"
else
  ok "Backend virtual environment already exists"
fi

source "$BACKEND_DIR/venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "$BACKEND_DIR/requirements.txt"
ok "Backend dependencies installed"

cd "$FRONTEND_DIR"
npm install
ok "Frontend dependencies installed"

cd "$PROJECT_DIR"
chmod +x scripts/local-*.sh 2>/dev/null || true

echo
ok "Local setup complete"
echo "Next steps:"
echo "1. Make sure PostgreSQL is running locally"
echo "2. Make sure database 'billing' exists"
echo "3. Run: ./scripts/local-dev.sh"