#!/usr/bin/env bash
set -euo pipefail

GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; CYAN="\033[36m"; BOLD="\033[1m"; RESET="\033[0m"

ok()     { echo -e "${GREEN}✔ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠ $1${RESET}"; }
fail()   { echo -e "${RED}✘ $1${RESET}"; exit 1; }
info()   { echo -e "${CYAN}→ $1${RESET}"; }
header() { echo -e "\n${BOLD}$1${RESET}"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 not found. $2"
}

check_port_free() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    return 1
  fi
}

find_free_port() {
  local port="$1"
  while ! check_port_free "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}