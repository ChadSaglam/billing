#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# setup.sh — First-time project setup for billing
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"

log_ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
log_warn()  { echo -e "  ${YELLOW}⊘${RESET} $1"; }
log_error() { echo -e "  ${RED}✗${RESET} $1"; }

echo -e "${BOLD}🧾 billing — Setup${RESET}"
echo ""

# ── Prerequisites ──────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${RESET}"

require() {
  local cmd="$1" install_hint="$2"
  if command -v "$cmd" &> /dev/null; then
    log_ok "$cmd $(command "$cmd" --version 2>/dev/null | head -1)"
  else
    log_error "$cmd not found — $install_hint"
    exit 1
  fi
}

require docker "https://docker.com"
require node "https://nodejs.org (v20+)"
require npm "installed with Node.js"
echo ""

# ── .env ───────────────────────────────────────────────
echo -e "${BOLD}Environment...${RESET}"
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    log_warn ".env created from .env.example — review and fill in secrets"
  else
    log_error "No .env or .env.example found"
    exit 1
  fi
else
  log_ok ".env exists"
fi
echo ""

# ── Backend ────────────────────────────────────────────
echo -e "${BOLD}Setting up backend...${RESET}"
cd backend

if [[ ! -d "venv" ]]; then
  if command -v python3 &> /dev/null; then
    python3 -m venv venv
    log_ok "Virtual environment created"
  else
    log_warn "No local python3 — will use Docker only"
  fi
fi

if [[ -d "venv" ]]; then
  source venv/bin/activate
  pip install -q -r requirements.txt 2>/dev/null || {
    log_warn "Some pip packages failed (OK — backend runs in Docker with Python 3.12)"
  }
fi

mkdir -p uploads
log_ok "uploads directory ready"

cd "$PROJECT_DIR"
echo ""

# ── Frontend ───────────────────────────────────────────
echo -e "${BOLD}Setting up frontend...${RESET}"
cd frontend
npm install --silent
log_ok "Node dependencies installed"
cd "$PROJECT_DIR"
echo ""

# ── Docker ─────────────────────────────────────────────
echo -e "${BOLD}Building Docker images...${RESET}"
docker compose build
log_ok "Docker images built"
echo ""

# ── Port Check ─────────────────────────────────────────
echo -e "${BOLD}Checking ports...${RESET}"
for port in 9202 9201 9200; do
  if lsof -i :"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    proc_pid=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
    proc_name=$(ps -p "$proc_pid" -o comm= 2>/dev/null || echo "unknown")
    log_warn "Port $port in use by $proc_name (PID $proc_pid)"
  else
    log_ok "Port $port available"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo ""
echo "Start services:"
echo "  ./scripts/dev.sh"
echo ""
echo "Verify (in another terminal):"
echo "  ./scripts/test.sh"
echo "  ./scripts/project-overview.sh"