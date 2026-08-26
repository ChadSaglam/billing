# Billing

Multi-tenant invoicing and quoting SaaS for small businesses — quotes (Offerte),
invoices (Rechnungen), Swiss QR-bill PDFs, a client portal, and recurring billing.

Built with FastAPI, React 19, PostgreSQL 16 and Docker.

> Working on this codebase? Read **[CLAUDE.md](CLAUDE.md)** first — it has the
> architecture, the tenant-scoping rule, and the conventions.

---

## Ports

This project owns the **92xx** block so it never collides with anything else
running locally.

| Service     | Port | URL                       |
|-------------|------|---------------------------|
| Frontend    | 9200 | http://localhost:9200     |
| Backend API | 9201 | http://localhost:9201     |
| API docs    | 9201 | http://localhost:9201/docs |
| PostgreSQL  | 9202 | `localhost:9202`          |

Change them in `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `DB_PORT`) — nothing is
hardcoded.

---

## Quick start (Docker)

```bash
cp .env.example .env
./scripts/gen-secret.sh          # fills SECRET_KEY + POSTGRES_PASSWORD
# then paste POSTGRES_PASSWORD into DATABASE_URL in .env

docker compose up --build
```

Open http://localhost:9200 and create your workspace. Signup provisions a tenant,
an admin user, and a 14-day trial.

## Quick start (local, no Docker)

```bash
cp .env.example .env
./scripts/gen-secret.sh
./scripts/local-setup.sh         # venv + npm install
./scripts/local-dev.sh           # starts API + frontend
```

---

## Demo data

The seed endpoint fills **your own workspace** — it never touches other tenants.
Register through the UI, then:

```bash
# credentials come from the environment — never commit them
export BILLING_EMAIL="you@example.com"
export BILLING_PASSWORD="…"

TOKEN=$(curl -sf -X POST http://localhost:9201/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BILLING_EMAIL\",\"password\":\"$BILLING_PASSWORD\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -X POST http://localhost:9201/api/seed -H "Authorization: Bearer $TOKEN"
```

---

## Tests

```bash
# Backend
cd backend && source venv/bin/activate
pip install -r requirements-dev.txt
pytest

# Lint
ruff check backend
cd frontend && npm run lint && npx tsc -b

# End-to-end
cd frontend && npx playwright test
```

CI runs all of the above on every push — see `.github/workflows/ci.yml`.

---

## SaaS model

| Plan     | CHF/mo | Users | Clients | Docs/month | Notable features            |
|----------|--------|-------|---------|------------|-----------------------------|
| Trial    | 0      | 2     | 10      | 20         | 14 days, PDF + portal       |
| Starter  | 19     | 1     | 50      | 100        | + email sending             |
| Pro      | 49     | 5     | 500     | 1000       | + recurring, bulk, export   |
| Business | 99     | ∞     | ∞       | ∞          | + webhooks, API, AI         |

Plans live in `backend/app/plans.py` — one file, single source of truth.
Limits are enforced with `enforce_limit()` at the write endpoints; an over-limit
request returns **402** with a machine-readable `detail`.

Payments are not wired up yet. `POST /api/tenant/plan` flips the plan directly,
which is fine pre-revenue — before launch it must move behind a verified
provider webhook.

---

## Security

- **Never commit `.env`.** Use `.env.example` as the template.
- `SECRET_KEY` is validated at startup; the app refuses to boot with a
  placeholder, a short key, or `ALLOWED_ORIGINS=*` in production.
- Credentials in docs and scripts are always environment variables.
- If a secret ever lands in a commit: rotate it first, then run
  `./scripts/scrub-git-history.sh` and force-push.

---

## Layout

```
billing/
├── backend/          FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── api/      routers (one per resource)
│   │   ├── models/   SQLAlchemy models — every table has tenant_id
│   │   ├── schemas/  Pydantic request/response
│   │   ├── services/ business logic (PDF, QR-bill, email, recurring)
│   │   └── plans.py  plan definitions + limit enforcement
│   └── tests/        pytest, starting with tenant isolation
├── frontend/         React 19 + Vite + Tailwind + shadcn/ui
├── scripts/          dev, setup, smoke tests, secret tooling
└── .github/workflows CI
```

---

## License

Proprietary.
