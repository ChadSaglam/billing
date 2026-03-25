#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# setup.sh — First-time project setup for chadev-billing
# ─────────────────────────────────────────────────────────
set -euo pipefail

CYAN="\033[36m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"; BOLD="\033[1m"

echo -e "${BOLD}🧾 chadev-billing — Setup${RESET}"
echo ""

# ── Prerequisites ──────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${RESET}"

check() {
  if command -v "$1" &> /dev/null; then
    echo -e "  ${GREEN}✓${RESET} $1 $($1 --version 2>/dev/null | head -1)"
  else
    echo -e "  ${RED}✗${RESET} $1 not found"
    return 1
  fi
}

check docker || { echo "Install Docker: https://docker.com"; exit 1; }
check node || { echo "Install Node.js 20+: https://nodejs.org"; exit 1; }
check npm || exit 1
echo ""

# ── Backend ────────────────────────────────────────────
echo -e "${BOLD}Setting up backend...${RESET}"
cd backend

if [ ! -d "venv" ]; then
  if command -v python3 &> /dev/null; then
    python3 -m venv venv
    echo -e "  ${GREEN}✓${RESET} Virtual environment created"
  else
    echo -e "  ${YELLOW}⊘${RESET} No local python3 — will use Docker only"
  fi
fi

if [ -d "venv" ]; then
  source venv/bin/activate
  pip install -q -r requirements.txt 2>/dev/null || {
    echo -e "  ${YELLOW}⊘${RESET} Some pip packages failed (OK — backend runs in Docker with Python 3.12)"
  }
fi

if [ ! -d "uploads" ]; then
  mkdir -p uploads
  echo -e "  ${GREEN}✓${RESET} uploads directory created"
fi

cd ..

# ── Frontend ───────────────────────────────────────────
echo -e "${BOLD}Setting up frontend...${RESET}"
cd frontend
npm install --silent
echo -e "  ${GREEN}✓${RESET} Node dependencies installed"
cd ..

# ── Docker ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Building Docker images...${RESET}"
docker compose build
echo -e "  ${GREEN}✓${RESET} Docker images built"

# ── Port Check ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Checking ports...${RESET}"
for port in 5434 8001 5173; do
  if lsof -i :"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    PROC=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
    PNAME=$(ps -p "$PROC" -o comm= 2>/dev/null || echo "unknown")
    echo -e "  ${YELLOW}⊘${RESET} Port ${port} in use by ${PNAME} (PID ${PROC})"
    if [ "$port" = "5434" ]; then
      echo -e "    ${CYAN}Tip: Remove 'ports' from db service in docker-compose.yml if not needed${RESET}"
    fi
  else
    echo -e "  ${GREEN}✓${RESET} Port ${port} available"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo ""
echo "Start services:"
echo "  ./scripts/dev.sh          # development mode"
echo ""
echo "Verify & In another terminal:"
echo "  ./scripts/test.sh              # run all checks"
echo "  ./scripts/project-overview.sh"
