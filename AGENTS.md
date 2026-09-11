# AGENTS.md — how to work in this repo

Canonical brief for any AI agent (Claude, Copilot, Cursor, Codex) or new human
contributor. `CLAUDE.md` points here. **Read this before editing.**

---

## 1. What this is

Multi-tenant Swiss invoicing SaaS (ChaDev Platform, product 1 of 2 — the sibling
is `buchhaltung`, the bookkeeping app). A tenant manages clients and service
templates, writes Offerten and Rechnungen with Swiss VAT and QR-bill, sends them
by email or shares a public portal link, and marks them paid. Paid invoices are
pushed to buchhaltung as platform events.

**Not** a single-company internal tool. Every feature must work for many tenants.

| Layer | Stack |
|---|---|
| Frontend | React 19 + Vite 7, TypeScript strict, Tailwind 3, shadcn/ui (Radix), TanStack Query, react-router 7, axios |
| Backend | FastAPI, SQLAlchemy 2 **sync** + psycopg2, Pydantic 2, Alembic, slowapi rate limits |
| DB | PostgreSQL 16 only (dev, test, CI, prod — no SQLite) |
| PDF | reportlab + qrcode (`services/pdf_generator.py`, `services/qr_reference.py`) |
| Auth | JWT (python-jose) + bcrypt, refresh tokens in DB, roles `admin` / `editor` / `viewer` |
| Platform | SSO hand-off issuer (`api/sso.py`), outbound events outbox (`services/events.py`) |

Ports (from `.env`, defaults in `scripts/lib/common.sh`): frontend **5050**,
backend **9000**, Postgres **9432**. The e2e CI stack uses 5150 / 9100.

---

## 2. Commands — use these, don't improvise

```bash
make setup       # ./scripts/setup.sh local + Playwright browser + git hooks
make dev         # ./scripts/dev.sh — backend + frontend (docker if available, else local)
make check       # lint + typecheck + tests  ← run before you claim done
make fix         # auto-fix ruff + eslint
make api-types   # regenerate frontend/src/types/api.generated.ts from the running API
make migration m="add xyz"   # create an Alembic migration
make migrate     # apply migrations
make status      # regenerate STATUS.md (counts, version, open roadmap items)
make doctor      # which interpreters/tools this repo is actually using
make stop        # free ports 9000 / 5050
```

`make test-backend` needs a PostgreSQL URL: `tests/conftest.py` reads `.env`
itself, or pass `make test-backend DATABASE_URL=postgresql://…/billing_test`.
`make test-e2e` needs the API running on `E2E_API_URL` (see `.github/workflows/ci.yml`).

If a tool is suddenly "not found", run `make doctor`. Almost always it means
`backend/venv` picked up a second Python version — fix with
`rm -rf backend/venv && make setup`.

---

## 3. Non-negotiable rules

1. **Tenant isolation.** Every query on tenant data goes through
   `scoped(db, Model, tenant_id)` / `get_or_404(...)` from
   `backend/app/services/tenancy.py`, with `tenant_id` from
   `Depends(get_tenant_id)` (`backend/app/auth.py`). Never from the body or a
   query param. `tests/test_tenant_scoping_guard.py` fails the build when a
   router queries a tenant-bearing model without going through the helper. New
   tenant tables get a `tenant_id` column + index and a case in
   `tests/test_tenant_isolation.py`.
2. **No invented surface.** Do not reference files, routes, columns or config
   keys that do not exist. Grep first. Say so when context is missing.
3. **Schema changes go through Alembic.** `make migration m="…"`. There is no
   `create_all` anywhere — `alembic upgrade head` builds the schema in dev,
   tests (`conftest.py`), Docker (`docker-entrypoint.sh`) and CI, which also
   checks that the head migration downgrades and warns on model drift.
4. **Config lives in `backend/app/config.py`** (`settings`). No hardcoded URLs,
   secrets, or origins anywhere else. `ALLOWED_ORIGINS` is a string — read
   `settings.allowed_origins`. Platform keys (`PLATFORM_SHARED_SECRET`,
   `BUCHHALTUNG_URL`, `BUCHHALTUNG_API_URL`) are optional; unset means the
   feature is off, never a crash. Never log the shared secret.
5. **The API is the contract.** Change a router or schema → run `make api-types`
   and commit `frontend/src/types/api.generated.ts`. Cross-product shapes (SSO,
   events, errors) are specified in `chadev-platform/contracts/`.
6. **Errors are uniform.** Every non-2xx response is
   `{"detail": …, "error": {"code", "message", "request_id"}}`
   (`backend/app/core/errors.py`; `detail` is the legacy field, R-96 drops it).
   The frontend reads it only through `getApiErrorMessage` / `getRequestId` in
   `frontend/src/lib/errors.ts`, then `toast(...)` from `hooks/use-toast.tsx`.
   Do not invent new shapes.
7. **User-facing strings are bilingual (DE default, EN)** and go through
   `frontend/src/lib/i18n.ts`: add the key to the `de` dictionary (source of
   truth) and to `en`, read it with `useT()` in components / `t()` elsewhere.
   PDF and email copy per document is still open (R-101).
8. **Money is `Decimal`, CHF by default, 5-Rappen rounding** on cash totals
   (`backend/app/services/money.py`). VAT rates, numbering
   (`services/number_generator.py`) and the QR reference
   (`services/qr_reference.py`) are domain code — don't reinvent them.
9. **Roles gate writes.** `require_editor` / `require_admin` from
   `backend/app/auth.py` on every mutating route; `viewer` is read-only.
10. **Prefer the safest correct fix** over the clever one. Match the surrounding
    patterns rather than introducing a new style.

---

## 4. Where things live

```
backend/app/
  main.py       app factory, router registration, /api/health, lifespan (in-API jobs)
  config.py     Settings (pydantic-settings) — the only place env is read
  auth.py       JWT, get_current_user, get_tenant_id, require_role/editor/admin
  database.py   engine, SessionLocal, get_db
  limiter.py    slowapi rate limits
  core/         errors (envelope + request id), logging_config, sentry
  models/       SQLAlchemy models — one file per table (tenant, user, client,
                document, line_item, service_template, settings, refresh_token,
                outbound_event)
  schemas/      Pydantic request/response models
  api/          HTTP layer only: validate → tenancy helper / service → schema
                (auth, clients, documents, dashboard, settings, services,
                portal, users, sso)
  services/     Business logic: tenancy, money, number_generator, pdf_generator,
                qr_reference, email_sender, sanitizer, storage (StorageBackend:
                local | s3), jobs + overdue_checker + recurring_invoices,
                events (platform outbox)
  jobs.py       `python -m app.jobs [--once]` — the dedicated job runner
  seed.py       sample data
backend/alembic/versions/   migrations
backend/tests/              conftest (Postgres via alembic, savepoint rollback per test),
                            test_tenant_isolation, test_tenant_scoping_guard, …

frontend/src/
  App.tsx           routes (react-router): /, /clients, /documents, /settings,
                    /onboarding, /login, /portal/:token
  pages/            one file per route
  components/       Layout (nav + AppSwitcher), shared/ (PageHeader, DataTable,
                    EmptyState, ErrorState, PageSkeleton, ConfirmDialog, …),
                    ui/ (shadcn primitives), clients/ documents/ settings/
  hooks/            use-toast, use-dark-mode, use-focus-trap, use-keyboard-shortcuts
  lib/              api.ts (axios + refresh) · auth.ts (tokens) · errors.ts · i18n.ts
                    query-keys.ts · optimistic.ts · utils.ts
  types/            api.generated.ts (GENERATED) · index.ts (app-facing types)
  test/             vitest (pure helpers only)
frontend/e2e/       Playwright: billing-flow.spec.ts (happy path), a11y.spec.ts (axe)
```

### Adding a backend endpoint

1. Pydantic schema in `schemas/`.
2. Business logic in `services/` (tenant-scoped, testable without HTTP).
3. Thin route in `api/<module>.py`: `Depends(get_db)`, `Depends(get_tenant_id)`,
   `Depends(require_editor)` for writes; queries via `scoped()` / `get_or_404()`.
4. Register the router in `app/main.py` (only if the module is new).
5. `make api-types` → use the generated type in the frontend.
6. Tests: happy path + a tenant-isolation case + an RBAC case (`tests/test_rbac.py`).

### Adding a frontend page

1. `pages/<Name>.tsx`, route in `App.tsx`, nav entry in `components/Layout.tsx`
   (`navItems`); the ⌘K palette (`components/shared/CommandPalette.tsx`) keeps
   its own list — add the page there too.
2. Data via TanStack Query with keys from `lib/query-keys.ts`, calls in `lib/api.ts`.
3. Types from `types/` — never hand-written response interfaces.
4. Errors through `getApiErrorMessage(err, fallback)` → `toast(...)`.
5. Every async surface needs three states: `PageSkeleton`, `EmptyState`, `ErrorState`.
6. Copy through `useT()` — add DE + EN keys to `lib/i18n.ts`.

---

## 5. Definition of done

- [ ] `make check` is green (lint · typecheck · tests).
- [ ] New tenant data is isolation-tested and goes through `services/tenancy.py`.
- [ ] Schema change has a migration that downgrades cleanly.
- [ ] API change has regenerated `api.generated.ts` committed.
- [ ] No secret, hostname, or origin hardcoded outside `config.py`.
- [ ] Loading / empty / error states exist for anything async.
- [ ] DE + EN copy for anything the user reads.
- [ ] The PR names the R-ID it closes (`ROADMAP.md`).

## 6. Known debt (fix opportunistically, don't let it block you)

- Open work is tracked in `ROADMAP.md` (one running list, R-IDs); `STATUS.md`
  is the generated snapshot (`make status`).
- `ruff format --check` reports drift in ~47 backend files; CI runs it
  `continue-on-error` and `make lint` only warns. Making it strict is R-81 —
  format files you touch, don't reformat the tree in an unrelated PR.
- `README.md` (R-79) and `SPEC.md` (R-78) lag behind the code; trust
  `AGENTS.md`, `ROADMAP.md`, `.env.example` and the code.
- `frontend/src/types/index.ts` still hand-writes most request/response
  interfaces next to the generated `API` namespace; new code should use the
  generated types.
- Frontend unit tests (vitest) cover pure helpers only; components and pages
  are covered by Playwright e2e (`frontend/e2e/`).
- `frontend/package.json` is still named `frontend-tmp` (R-80).
