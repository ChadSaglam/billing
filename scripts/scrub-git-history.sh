#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# DESTRUCTIVE: rewrites every commit to purge leaked secrets.
#
#   1. Deletes every committed env file (.env, .env.bak, …) from
#      ALL history — .env.example is kept.
#   2. Replaces every secret VALUE those files ever contained,
#      wherever else it appears (README, scripts, notes).
#   3. Adds anything listed in scripts/.scrub-extra (gitignored).
#   4. Verifies nothing survived before letting you push.
#
# Secrets are discovered from history at runtime — none are
# written into this script, because this script is committed.
#
# Compatible with bash 3.2 (the /bin/bash macOS ships).
# Uses git-filter-repo when available, else git filter-branch.
# ─────────────────────────────────────────────────────────────
set -eu
cd "$(dirname "$0")/.."

ASSUME_YES=0
[ "${1:-}" = "--yes" ] && ASSUME_YES=1

EXTRA_FILE="scripts/.scrub-extra"
REPLACEMENT='***REMOVED***'

# ── Preflight: the rewrite needs a clean tree ────────────────
# filter-branch refuses outright ("Cannot rewrite branches: You have unstaged
# changes"), and filter-repo aborts too. Fail here, before the backup, with an
# answer rather than an error.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Your working tree has uncommitted changes."
  echo
  git status --short --untracked-files=no | head -10
  [ "$(git status --porcelain --untracked-files=no | wc -l)" -gt 10 ] && echo "  … and more"
  echo
  echo "Rewriting history needs a clean tree. Either:"
  echo "  git add -A && git commit -m 'your message'     # keep the work"
  echo "  git stash -u                                   # park it, restore after"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Note: untracked files present. They are left alone by the rewrite."
  echo
fi

TMPDIR_SCRUB="$(mktemp -d)"
cleanup() { rm -rf "$TMPDIR_SCRUB"; }
trap cleanup EXIT

PATHS_FILE="$TMPDIR_SCRUB/paths"
SECRETS_FILE="$TMPDIR_SCRUB/secrets"
: > "$PATHS_FILE"
: > "$SECRETS_FILE"

# ── 1. Every env file ever committed ─────────────────────────
git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null \
  | grep -E '(^|/)\.env($|\.)' \
  | grep -v '\.env\.example$' \
  | sort -u > "$PATHS_FILE" || true

# ── 2. Harvest the secret values out of them ─────────────────
harvest_blob() {
  # `|| [ -n "$line" ]` matters: env files often lack a trailing newline,
  # and a plain `read` silently drops that last line — which is exactly
  # where the most recently added secret tends to live.
  git cat-file -p "$1" 2>/dev/null | while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '#'*|'') continue ;;
      *=*)     ;;
      *)       continue ;;
    esac
    value="${line#*=}"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    value="${value% }"
    # Not secrets: too short, URLs, JSON lists, plain numbers, placeholders.
    [ ${#value} -ge 8 ] || continue
    case "$value" in
      http*|'['*|*CHANGE_ME*|*changeme*) continue ;;
    esac
    case "$value" in
      *[!0-9]*) printf '%s\n' "$value" ;;
    esac
  done
}

while IFS= read -r path || [ -n "$path" ]; do
  [ -n "$path" ] || continue
  git log --all --pretty=%H -- "$path" | while IFS= read -r rev || [ -n "$rev" ]; do
    blob=$(git rev-parse "$rev:$path" 2>/dev/null) || continue
    harvest_blob "$blob"
  done
done < "$PATHS_FILE" >> "$SECRETS_FILE"

# A DATABASE_URL hides a password inside it. Pull it out, and also add the
# URL-decoded form — %2F in a connection string is a literal / everywhere else.
grep -oE '://[^:/]+:[^@]+@' "$SECRETS_FILE" 2>/dev/null \
  | sed -E 's|^://[^:/]+:||; s|@$||' >> "$SECRETS_FILE" || true
if command -v python3 >/dev/null 2>&1; then
  python3 - "$SECRETS_FILE" <<'PYEOF' >> "$SECRETS_FILE" || true
import sys
from urllib.parse import unquote

lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().split("\n")
for line in lines:
    if "%" in line:
        decoded = unquote(line)
        if decoded != line and len(decoded) >= 8:
            print(decoded)
PYEOF
fi

# Anything you want scrubbed that was never in an env file.
if [ -f "$EXTRA_FILE" ]; then
  grep -vE '^[[:space:]]*(#|$)' "$EXTRA_FILE" >> "$SECRETS_FILE" || true
fi

# Dedupe; longest first so a substring never gets half-replaced.
sort -u "$SECRETS_FILE" | awk '{ print length, $0 }' | sort -rn | cut -d' ' -f2- \
  > "$SECRETS_FILE.tmp"
mv "$SECRETS_FILE.tmp" "$SECRETS_FILE"

N_SECRETS=$(grep -c . "$SECRETS_FILE" || true)
N_PATHS=$(grep -c . "$PATHS_FILE" || true)

# ── 3. Report and confirm ────────────────────────────────────
echo "Env files to delete from all history:"
if [ "$N_PATHS" -eq 0 ]; then echo "  (none)"; else sed 's/^/  /' "$PATHS_FILE"; fi
echo
echo "Secret values to replace: $N_SECRETS"
while IFS= read -r s || [ -n "$s" ]; do
  [ -n "$s" ] || continue
  printf '  - %s… (%d chars)\n' "$(printf '%s' "$s" | cut -c1-3)" "${#s}"
done < "$SECRETS_FILE"
echo

if [ "$N_SECRETS" -eq 0 ] && [ "$N_PATHS" -eq 0 ]; then
  echo "Nothing to scrub."; exit 0
fi

echo "This rewrites ALL commit hashes. Anyone with a clone must re-clone."
if [ "$ASSUME_YES" -eq 1 ]; then
  echo "(--yes given, skipping confirmation)"
else
  printf 'Type SCRUB — in capitals — to continue: '
  read -r confirm
  if [ "$confirm" != "SCRUB" ]; then
    echo
    echo "ABORTED — nothing was changed. Your history still contains the secrets."
    echo "Re-run and type exactly: SCRUB"
    echo "Or run non-interactively:  ./scripts/scrub-git-history.sh --yes"
    exit 1
  fi
fi

# ── 4. Safety net ────────────────────────────────────────────
BACKUP="../$(basename "$PWD")-backup-$(date +%Y%m%d-%H%M%S).bundle"
git bundle create "$BACKUP" --all >/dev/null 2>&1
echo "✔ Backup: $BACKUP  (restore: git clone $BACKUP recovered)"
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
echo

# ── 5. Rewrite ───────────────────────────────────────────────
if git filter-repo --version >/dev/null 2>&1; then
  echo "Using git-filter-repo."
  REPL="$TMPDIR_SCRUB/replacements"
  : > "$REPL"
  while IFS= read -r s || [ -n "$s" ]; do
    [ -n "$s" ] || continue
    printf '%s==>%s\n' "$s" "$REPLACEMENT" >> "$REPL"
  done < "$SECRETS_FILE"

  set -- --force
  while IFS= read -r p || [ -n "$p" ]; do
    [ -n "$p" ] || continue
    set -- "$@" --path "$p" --invert-paths
  done < "$PATHS_FILE"
  [ -s "$REPL" ] && set -- "$@" --replace-text "$REPL"

  git filter-repo "$@"
else
  echo "git-filter-repo not installed — using git filter-branch."
  echo "(For the fast path next time: brew install git-filter-repo)"
  echo

  PY=$(command -v python3 || command -v python) || { echo "Need python3."; exit 1; }
  SCRUB_PY="$TMPDIR_SCRUB/scrub.py"
  cat > "$SCRUB_PY" <<'PYEOF'
import os
import subprocess
import sys

secrets = [s for s in open(sys.argv[1], encoding="utf-8").read().split("\n") if s]
drop_paths = {p for p in open(sys.argv[2], encoding="utf-8").read().split("\n") if p}
replacement = b"***REMOVED***"

for path in drop_paths:
    if os.path.isfile(path):
        os.remove(path)

listing = subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True)
for raw in listing.stdout.split(b"\0"):
    if not raw:
        continue
    path = raw.decode("utf-8", "surrogateescape")
    if path in drop_paths or not os.path.isfile(path):
        continue
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        continue
    if b"\0" in data[:8000]:      # binary
        continue
    original = data
    for secret in secrets:
        data = data.replace(secret.encode(), replacement)
    if data != original:
        with open(path, "wb") as fh:
            fh.write(data)
PYEOF

  RM_ARGS=""
  while IFS= read -r p || [ -n "$p" ]; do
    [ -n "$p" ] || continue
    RM_ARGS="$RM_ARGS $(printf '%q' "$p")"
  done < "$PATHS_FILE"

  INDEX_FILTER="true"
  [ -n "$RM_ARGS" ] && INDEX_FILTER="git rm -r --cached --ignore-unmatch$RM_ARGS >/dev/null"

  FILTER_BRANCH_SQUELCH_WARNING=1 \
  git filter-branch --force \
    --index-filter "$INDEX_FILTER" \
    --tree-filter "$PY $(printf '%q' "$SCRUB_PY") $(printf '%q' "$SECRETS_FILE") $(printf '%q' "$PATHS_FILE")" \
    --tag-name-filter cat -- --all

  git for-each-ref --format='delete %(refname)' refs/original \
    | git update-ref --stdin || true
  git reflog expire --expire=now --all
  git gc --prune=now --quiet
fi

# ── 6. Verify ────────────────────────────────────────────────
echo
echo "Verifying…"
FAILED=0
ALL_REVS=$(git rev-list --all)
while IFS= read -r s || [ -n "$s" ]; do
  [ -n "$s" ] || continue
  if git grep -q -F -- "$s" $ALL_REVS 2>/dev/null; then
    printf '  ✘ still in history: %s… (%d chars)\n' "$(printf '%s' "$s" | cut -c1-3)" "${#s}"
    FAILED=1
  fi
done < "$SECRETS_FILE"
while IFS= read -r p || [ -n "$p" ]; do
  [ -n "$p" ] || continue
  if git log --all --oneline -- "$p" | grep -q .; then
    echo "  ✘ still in history: $p"; FAILED=1
  fi
done < "$PATHS_FILE"

if [ "$FAILED" -ne 0 ]; then
  echo; echo "Not clean — do NOT push. Restore from $BACKUP if needed."; exit 1
fi
echo "  ✔ all clear"

echo
echo "Next:"
[ -n "$REMOTE_URL" ] && echo "  git remote add origin $REMOTE_URL   # filter-repo drops remotes"
echo "  git push --force --all && git push --force --tags"
echo
echo "Then ROTATE everything that was exposed:"
echo "  ./scripts/gen-secret.sh --rotate"
echo "  • SMTP password — regenerate it at your mail provider"
echo "  • database password — see the command gen-secret.sh prints"
echo "  • the account password you used in the old README"
