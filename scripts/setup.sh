#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# setup.sh — first-time setup
#
#   ./scripts/setup.sh          # everything: venv, npm, docker images
#   ./scripts/setup.sh local    # venv + npm only (no docker)
#   ./scripts/setup.sh docker   # docker images + npm only (no venv)
# ─────────────────────────────────────────────────────────
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

MODE="${1:-all}"
[[ "$MODE" =~ ^(all|local|docker)$ ]] || die "Unknown mode '$MODE' — use: all | local | docker"

echo -e "${BOLD}🧾 Setup (${MODE})${RESET}"
echo ""

# ── Prerequisites ──────────────────────────────────────
log_info "Prerequisites"
require() {
  if have "$1"; then log_ok "$1 $(command "$1" --version 2>/dev/null | head -1 | cut -c1-40)"
  else die "$1 not found — $2"; fi
}
require node "https://nodejs.org (v20+)"
require npm "ships with Node.js"
[[ "$MODE" != "docker" ]] && { require python3 "Python 3.12+"; have psql || log_warn "psql not found — local DB checks will be skipped"; }
[[ "$MODE" != "local"  ]] && require docker "https://docker.com"
echo ""

# ── .env ───────────────────────────────────────────────
log_info "Environment"
cd "$PROJECT_DIR"
if [[ ! -f .env ]]; then
  [[ -f .env.example ]] || die "no .env and no .env.example"
  cp .env.example .env
  log_warn ".env created from .env.example — fill in the secrets before continuing"
else
  log_ok ".env exists"
fi
load_env
init_config
echo ""

# ── Backend ────────────────────────────────────────────
if [[ "$MODE" != "docker" ]]; then
  log_info "Backend"
  # Never a bare `python3`: the newest interpreter on the machine (Homebrew
  # 3.14 today) routinely outruns what pinned deps support — SQLAlchemy
  # 2.0.35 cannot even scan the models on 3.14. CI and Docker run 3.12, so
  # prefer it, then 3.13, and only then whatever `python3` happens to be.
  if [[ ! -d "$VENV_DIR" ]]; then
    PY_BIN="$(command -v python3.12 || command -v python3.13 || command -v python3)"
    "$PY_BIN" -m venv "$VENV_DIR" && log_ok "venv created ($("$PY_BIN" --version 2>&1))"
  fi
  # shellcheck disable=SC1091
  source "$VENV_DIR/bin/activate"
  python -m pip install -q --upgrade pip
  if [[ -f "$BACKEND_DIR/requirements-dev.txt" ]]; then
    pip install -q -r "$BACKEND_DIR/requirements-dev.txt" && log_ok "dependencies + dev tools installed"
  else
    pip install -q -r "$BACKEND_DIR/requirements.txt" && log_ok "dependencies installed"
  fi
  mkdir -p "$BACKEND_DIR/uploads/logos" && log_ok "uploads/ ready"
  deactivate
  echo ""
fi

# ── Frontend ───────────────────────────────────────────
log_info "Frontend"
(cd "$FRONTEND_DIR" && npm install --silent) && log_ok "node dependencies installed"
echo ""

# ── Docker ─────────────────────────────────────────────
if [[ "$MODE" != "local" ]]; then
  log_info "Docker images"
  $COMPOSE build && log_ok "images built"
  echo ""
fi

# ── Ports ──────────────────────────────────────────────
log_info "Ports"
for entry in "$FRONTEND_PORT:frontend" "$BACKEND_PORT:backend" "$DB_PORT:database"; do
  port="${entry%%:*}"; label="${entry##*:}"
  if port_in_use "$port"; then
    pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
    log_warn "port $port ($label) in use by $(ps -p "$pid" -o comm= 2>/dev/null || echo unknown)"
  else
    log_ok "port $port ($label) free"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}Setup complete${RESET}"
echo "  Start:    ./scripts/dev.sh"
echo "  Verify:   ./scripts/test.sh"
echo "  Overview: ./scripts/project-overview.sh"
