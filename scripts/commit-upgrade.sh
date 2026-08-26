#!/usr/bin/env bash
# Commit the August upgrade pass in four reviewable commits, then leave the
# tree clean so scrub-git-history.sh can run.
#
#   ./scripts/commit-upgrade.sh
#
# Nothing is pushed. Delete this script once it has run.
set -eu
cd "$(dirname "$0")/.."

# A previous session left git lock files behind that only you can remove.
if [ -d .git/_claude_stale ]; then
  rm -rf .git/_claude_stale
  echo "✔ removed leftover git lock files"
fi
rm -f .git/index.lock

[ -n "$(git status --porcelain)" ] || { echo "Nothing to commit."; exit 0; }

stage() {
  for path in "$@"; do
    [ -e "$path" ] || git ls-files --error-unmatch "$path" >/dev/null 2>&1 || continue
    git add -A -- "$path"
  done
}

commit() {
  git diff --cached --quiet && { echo "  (nothing staged — skipped)"; return 0; }
  git commit -q -F - <<MSG
$1

$2

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017ScEGaKkmWmmp61RwCwJNH
MSG
  echo "  ✔ $(git log -1 --format='%h %s')"
}

# ── 1/4 ──────────────────────────────────────────────────────
echo "1/4 security"
stage .gitignore .env.example SPEC.md \
      scripts/gen-secret.sh scripts/scrub-git-history.sh \
      backend/app/config.py backend/app/models/settings.py backend/app/seed.py
commit "security: remove leaked credentials and third-party data" \
"A password sat in plaintext in README.md, and a .env.bak was committed in
82337ca carrying SECRET_KEY, the SMTP password and the database password.

- CompanySettings had a real IBAN, UID, address and phone as *column
  defaults*, so every new tenant was provisioned with them. Now blank.
- seed.py shipped three real clients with addresses. Now fictional
  (.example domains).
- SPEC.md anonymised.
- .gitignore matched only the exact name '.env', which is how .env.bak got
  committed. Now .env.* / *.env.* with !.env.example.
- config.validate_runtime() refuses to boot on a placeholder or short
  SECRET_KEY, and on wildcard/localhost CORS in production.
- Added .env.example, gen-secret.sh (--rotate) and scrub-git-history.sh."

# ── 2/4 ──────────────────────────────────────────────────────
echo "2/4 rebrand + ports"
stage README.md docker-compose.yml backend/alembic.ini \
      frontend/Dockerfile frontend/vite.config.ts frontend/playwright.config.ts \
      frontend/package.json frontend/index.html frontend/src/main.tsx \
      frontend/src/pages/Login.tsx frontend/src/components/Layout.tsx \
      frontend/e2e/billing-flow.spec.ts \
      scripts/dev.sh scripts/local-backend.sh scripts/local-dev.sh \
      scripts/local-frontend.sh scripts/local-setup.sh scripts/local-test.sh \
      scripts/project-overview.sh scripts/setup.sh scripts/test.sh \
      test.pdf test_export.csv clients
commit "rebrand to Billing and move to the 92xx port block" \
"ChaDev was baked into the product name, the API title, package names and the
database name. It is now one tenant among many, not the product.

Ports were spread across 5173/8001/8002/5434 and collided with everything
else running locally. Now 9200 frontend, 9201 API, 9202 Postgres, all driven
by FRONTEND_PORT / BACKEND_PORT / DB_PORT.

- alembic.ini no longer hardcodes a connection string; env.py reads
  DATABASE_URL.
- vite.config.ts proxies /api and /uploads via VITE_API_PROXY_TARGET.
- docker-compose gained a frontend service and requires POSTGRES_PASSWORD.
- Dropped clients/ (per-customer installers contradict a SaaS), plus
  test.pdf, test_export.csv and structure.txt from the repo root."

# ── 3/4 ──────────────────────────────────────────────────────
echo "3/4 SaaS foundations"
stage backend/app/plans.py backend/app/rate_limit.py backend/app/api/tenant.py \
      backend/app/models/tenant.py backend/app/auth.py backend/app/api/auth.py \
      backend/app/api/clients.py backend/app/api/users.py \
      backend/app/api/documents.py backend/app/main.py \
      backend/alembic/versions/b1c2d3e4f5a6_add_saas_tenant_fields.py
commit "feat: plans, trials and per-tenant limits" \
"Multi-tenancy existed; the business model around it did not.

- plans.py is the single source of truth: trial / starter / pro / business.
- Tenant gains plan, status, trial_ends_at and billing provider ids.
- Signup provisions a workspace, an admin and a 14-day trial.
- enforce_limit() returns 402 with a machine-readable detail; an expired
  trial or inactive subscription makes the workspace read-only via the new
  require_writable_tenant dependency on every write endpoint.
- GET /api/tenant reports usage against the plan; /api/tenant/plans is the
  price book.
- One shared slowapi Limiter in rate_limit.py — there were two, so the auth
  rate limits were counting into separate buckets and doing nothing.
- preview_pdf accepted a refresh token as an access token.

Payments are not wired up: POST /api/tenant/plan still flips the column
directly. That must move behind a verified webhook before launch."

# ── 4/4 ──────────────────────────────────────────────────────
echo "4/4 CI, tests and docs"
stage .github CLAUDE.md backend/tests backend/pyproject.toml \
      backend/requirements-dev.txt backend/alembic/env.py \
      backend/app/api/dashboard.py backend/app/api/settings.py \
      backend/app/models/client.py backend/app/models/service_template.py \
      backend/app/schemas backend/app/services \
      scripts/provision.sh scripts/seed.py
commit "ci: add pytest suite, GitHub Actions and CLAUDE.md" \
"There were no automated tests and no CI.

- 40 tests. The important ones are tenant isolation: scoping is enforced by
  hand in ~51 places, so two workspaces are created and every endpoint is
  asserted to 404 across the boundary.
- CI runs five jobs: secret scan, backend lint + tests + migration
  round-trip, frontend lint + typecheck + build, a check that
  api.generated.ts still matches the OpenAPI schema, and a docker boot.
- ruff configured and 91 existing lint errors fixed.
- CLAUDE.md documents the tenant-scoping rule, the port block, the plan
  model, known gaps and the traps."

# ── anything left ────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "remainder"
  git add -A
  commit "chore: remaining files from the upgrade pass" \
"Files not covered by the four commits above."
fi

echo
echo "Done. $(git rev-list --count HEAD ^origin/main 2>/dev/null || echo '?') new commits, tree is clean."
echo
echo "Next:"
echo "  ./scripts/scrub-git-history.sh --yes"
echo "  git push --force --all && git push --force --tags"
