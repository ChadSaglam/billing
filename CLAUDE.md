# CLAUDE.md — Billing

Multi-tenant invoicing & quoting SaaS. Swiss market: German UI, Swiss QR-bill,
CHF. FastAPI + React 19 + PostgreSQL 16.

Read this before writing code. It is short on purpose.

---

## 1. The one rule: everything is tenant-scoped

Every table that holds customer data has `tenant_id`. Scoping is enforced **by
hand in every query**. A missing filter leaks one company's invoices to another.

```python
# ✅ always
db.query(Client).filter(Client.tenant_id == tenant_id)

# ❌ never
db.query(Client).all()
db.get(Client, client_id)          # no tenant check
```

Read endpoints take `tenant_id: int = Depends(get_tenant_id)`.
**Write** endpoints additionally take `tenant=Depends(require_writable_tenant)` —
that dependency is what blocks expired trials and unpaid accounts.

A cross-tenant lookup must return **404**, never 403 — 403 confirms the row
exists.

Any new endpoint gets a case in `backend/tests/test_tenant_isolation.py`.
That file is not optional.

---

## 2. Ports

This project owns the **92xx** block. Nothing is hardcoded — all three come
from `.env`.

| What        | Port | Env var         |
|-------------|------|-----------------|
| Frontend    | 9200 | `FRONTEND_PORT` |
| Backend API | 9201 | `BACKEND_PORT`  |
| PostgreSQL  | 9202 | `DB_PORT`       |

Inside docker-compose the backend container still listens on 8000 and is
published as 9201. The Vite proxy targets `VITE_API_PROXY_TARGET`.

---

## 3. Layout

```
backend/app/
  api/          one router per resource. Thin — no business logic.
  models/       SQLAlchemy. Every table has tenant_id.
  schemas/      Pydantic in/out. Never return a model directly.
  services/     business logic: pdf_generator, qr_reference, email_sender,
                recurring_invoices, overdue_checker, number_generator, sanitizer
  plans.py      plan definitions + limit enforcement (single source of truth)
  rate_limit.py the ONE shared slowapi Limiter — do not create another
  config.py     settings + validate_runtime() startup guard
  auth.py       JWT, password hashing, tenant dependencies
frontend/src/
  pages/        routed screens
  components/   ui/ = shadcn primitives, shared/ = our reusable pieces
  lib/api.ts    the single axios client — all requests go through it
  types/api.generated.ts   GENERATED. Never hand-edit.
```

---

## 4. SaaS model

Plans live in `backend/app/plans.py`. Adding a plan means editing that dict and
nothing else.

| Plan     | CHF/mo | Users | Clients | Docs/mo |
|----------|--------|-------|---------|---------|
| trial    | 0      | 2     | 10      | 20      |
| starter  | 19     | 1     | 50      | 100     |
| pro      | 49     | 5     | 500     | 1000    |
| business | 99     | ∞     | ∞       | ∞       |

- Signup (`POST /api/auth/register`) creates tenant + admin user + 14-day trial.
- `enforce_limit(tenant.plan, "max_clients", current_count)` → raises **402**
  with `detail.error == "plan_limit_reached"`.
- `require_feature(tenant.plan, "ai")` → **402** with `feature_not_in_plan`.
- Expired trial or `status != "active"` → workspace goes **read-only**, writes
  return 402 `trial_expired` / `subscription_inactive`.
- The frontend should render an upgrade wall on any 402 with a `detail.error`.

**Not done yet:** payments. `POST /api/tenant/plan` flips the column directly.
Before launch that must only run from a verified Stripe webhook.

---

## 5. Conventions

**A new endpoint**

1. Pydantic schema in `schemas/`
2. Handler in `api/<resource>.py` — `Depends(get_tenant_id)`, plus
   `Depends(require_writable_tenant)` if it writes
3. Business logic in `services/`, not in the router
4. Isolation test in `tests/test_tenant_isolation.py`
5. `cd frontend && npm run generate-api` (CI fails if you forget)

**Schema changes** — Alembic owns the schema.

```bash
cd backend
alembic revision -m "add x"      # then write upgrade AND downgrade
alembic upgrade head
```

`Base.metadata.create_all()` runs only when `APP_ENV != production`, purely so a
fresh clone boots. Never rely on it.

**Money** is `Decimal` / `Numeric(12, 2)` everywhere. Never float.

**Dates** are `date` for document dates, UTC `datetime` for timestamps.

**User input** that reaches a PDF or an email goes through
`services/sanitizer.sanitize_text()`.

**Errors**: `HTTPException` with a plain string for user-facing messages; a dict
with an `error` key when the frontend has to branch on it (the 402s above).

---

## 6. Running it

```bash
cp .env.example .env && ./scripts/gen-secret.sh
docker compose up --build             # → localhost:9200

# or bare metal
./scripts/local-setup.sh && ./scripts/local-dev.sh
```

Tests:

```bash
cd backend && pip install -r requirements-dev.txt
docker compose up -d db               # DB tests skip without it
pytest                                # 402 = plan limit, not an auth bug
ruff check .

cd frontend && npm run lint && npx tsc -b --noEmit && npm run build
npx playwright test
```

CI (`.github/workflows/ci.yml`) runs: secret scan → backend lint+tests+migration
round-trip → frontend lint+typecheck+build → API-types drift check → docker boot.

---

## 7. Security rules

- `.env` is never committed. CI fails the build if it is tracked.
- No credential, real client name, real address, UID or IBAN in the repo —
  including in `seed.py`, docs and tests. Demo data uses `.example` domains.
- `SECRET_KEY` is validated at startup: placeholder, short, or
  `ALLOWED_ORIGINS=*`/localhost in production → the app refuses to boot.
- Access tokens and refresh tokens are distinguished by a `type` claim.
  Anything that decodes a JWT must check it.
- If a secret is ever committed: rotate it, then `./scripts/scrub-git-history.sh`.

---

## 8. Known gaps — pick these up next

Ordered by how much they hurt.

1. **There is no initial migration.** The chain starts from a schema that
   `create_all()` already built, so `alembic upgrade head` against an empty
   database fails at the first revision. A fresh server cannot be built from
   migrations alone. Fix: squash the four revisions into one initial
   migration generated from the current models, then `alembic stamp` the
   existing databases onto it. Until then CI tests the newest migration by
   doing what the app does — `create_all` + `stamp head`, then a
   downgrade/upgrade round trip.
2. **Refresh tokens can't be revoked.** 30-day lifetime, no rotation, no
   denylist — logout doesn't really log out. Add a `revoked_jti` table.
3. **Portal tokens never expire.** `api/portal.py` looks up a document by token
   with no TTL and no access log. Add `portal_token_expires_at`.
4. **Background jobs run in the web process.** Fine at 1 worker; at 2 every
   recurring invoice is created twice. Move to a worker container or take a
   Postgres advisory lock before scaling out.
5. **`api/documents.py` (600+ lines) and `services/pdf_generator.py` (660+)**
   are 40% of the backend. Split into `services/documents/` and put tenant
   scoping in a repository layer, so rule #1 stops being manual.
6. **No i18n.** German is hardcoded in ~30 components and in the PDF templates.
   Switzerland needs DE/FR/IT/EN, and language belongs on the *client* record.
7. **`print()`-era observability.** stdlib logging is wired up; there is still
   no request ID and no Sentry.
8. **No AI features.** Planned: NL→invoice draft, receipt OCR, auto-dunning,
   NL search. Gate them behind `require_feature(plan, "ai")`.

---

## 9. Things that will bite you

- There must be exactly **one** `Limiter` instance (`app/rate_limit.py`). A
  second one silently gets its own counters and the rate limits do nothing.
- `bcrypt` truncates at 72 bytes — `auth.py` slices before hashing. Keep it.
- `TestClient(app)` is used **without** `with` in tests: the lifespan's startup
  jobs commit on their own session and would escape the test transaction.
- WeasyPrint needs system libs (pango, cairo). CI installs them; that is why
  `conftest.py` imports the app lazily, so non-DB tests run anywhere.
- The models use JSONB, so tests need real PostgreSQL — SQLite will not do.
