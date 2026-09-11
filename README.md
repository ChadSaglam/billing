# ChaDev Billing — Offerte & Rechnungen

Invoice and quote management software for **ChaDev** — built with FastAPI, React, PostgreSQL, and Docker.

## Features

- **Dashboard** — Revenue overview, outstanding/overdue tracking, monthly chart, recent activity
- **Clients** — Full client database with contact details, addresses, and document history
- **Offerte (Quotes)** — Create quotes with dynamic line items, discounts, and notes
- **Rechnungen (Invoices)** — Create invoices or convert accepted Offerte → Rechnung with one click
- **Service Catalog** — 16 pre-configured service templates across 5 categories (add/edit/delete/toggle)
- **PDF Generation** — German-language PDF invoices with Swiss QR-bill payment slip
- **Company Logo** — Upload a file or enter a URL, with live preview
- **Inline Client Creation** — Add new clients directly from the document form (no page switching)
- **Settings** — Tabbed layout: Company Info, Bank Details, Defaults, Services
- **Dark/Light Mode** — Full theme support with toggle
- **DE / EN interface** — German by default, English one click away (persisted per browser); PDFs stay German until R-101
- **Accessible** — keyboard-navigable dialogs, labelled controls, skip link; axe-core gate in the Playwright suite

## Tech Stack

| Layer    | Technology                                                    |
|----------|---------------------------------------------------------------|
| Backend  | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Alembic |
| Frontend | React 19 · TypeScript · Vite 7 · Tailwind CSS v3 · shadcn/ui (Radix) |
| Database | PostgreSQL 16                                                 |
| PDF      | ReportLab · qrcode (Swiss QR-bill)                            |
| Infra    | Docker Compose                                                |

---

## Ports

billing owns its own port family so it can run next to buchhaltung
(3000 / 8000 / 5432) with nothing overlapping. Every value is an
environment variable with the default shown; `.env` overrides all of them.

| Service      | Dev (`scripts/dev.sh`) | Docker (host port)          | E2E (Playwright)              |
|--------------|------------------------|-----------------------------|-------------------------------|
| Frontend     | `FRONTEND_PORT` 5050   | `FRONTEND_PORT` 5050 → 5173 | `E2E_FRONTEND_PORT` 5150      |
| Backend API  | `BACKEND_PORT` 9000    | `BACKEND_PORT` 9000 → 8000  | `E2E_API_URL` localhost:9100  |
| PostgreSQL   | `DB_PORT` 9432         | `DB_PORT` 9432 → 5432       | whatever `DATABASE_URL` says  |

Container-internal ports (right of the arrow) never change: uvicorn always
listens on 8000, the vite dev server on 5173 and Postgres on 5432 inside
the compose network. The e2e stack uses its own ports so a running dev
stack is never touched by a Playwright run.

---

## Quick Start (Docker)

```bash
cd billing
cp .env.example .env        # then set POSTGRES_PASSWORD and SECRET_KEY

# Build and start all services
docker compose up --build
```

Open your browser:

| Service       | URL                        |
|---------------|----------------------------|
| Frontend      | http://localhost:5050      |
| Backend API   | http://localhost:9000      |
| API Docs      | http://localhost:9000/docs |

### Rebuild after code changes

```bash
docker compose down -v          # -v removes volumes (resets database)
docker compose up --build
```

> **Note:** Services (16 templates) are auto-seeded on startup. The `/api/seed` endpoint creates sample clients and invoices.

---
## Quick Start (Local)

From the project root:

```bash
./scripts/dev.sh            # auto: docker if available, else local
./scripts/dev.sh docker     # postgres + backend in docker, vite on host
./scripts/dev.sh local      # postgres on host, uvicorn in venv, vite on host
```

Open:

| Service     | URL |
|-------------|-----|
| Frontend    | http://localhost:5050 |
| Backend API | http://localhost:9000 |
| API Docs    | http://localhost:9000/docs |

Run the checks in another terminal:

```bash
./scripts/test.sh
```
---
## Seed sample data

The seed endpoint requires authentication. First register or log in, then call `/api/seed` with a bearer token.

### Register a local user

```bash
curl -X POST http://localhost:9000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"***REMOVED***","password":"***REMOVED***","full_name":"Chad Saglam","company_name":"ChaDev"}'
```

### Log in

```bash
TOKEN=$(curl -sf -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"***REMOVED***","password":"***REMOVED***"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### Run seed

```bash
curl -X POST http://localhost:9000/api/seed \
  -H "Authorization: Bearer $TOKEN"
```
---

## Development without Docker

### Prerequisites

- Python 3.12
- Node.js + npm
- PostgreSQL reachable at the host/port in `DATABASE_URL` (default `localhost:9432`)
- A project `.env` file at the repo root (`cp .env.example .env`)

### Start everything

```bash
./scripts/dev.sh local
```

### Run checks

```bash
./scripts/test.sh
```

### End-to-end tests

The Playwright run starts its own vite dev server on 5150 and expects an API
on 9100, so it never collides with a dev stack on 5050 / 9000:

```bash
cd backend
DATABASE_URL=postgresql://.../billing_e2e ALLOWED_ORIGINS=http://localhost:5150 \
  FRONTEND_URL=http://localhost:5150 APP_ENV=test \
  python -m uvicorn app.main:app --port 9100 &
cd ../frontend && npx playwright test
```

### Stop everything

Press `Ctrl+C` in the terminal running `dev.sh`.

## Project Structure

```
billing/
├── backend/
│   ├── app/
│   │   ├── api/                    # FastAPI route handlers
│   │   │   ├── clients.py
│   │   │   ├── documents.py
│   │   │   ├── services.py         # Service template CRUD
│   │   │   ├── dashboard.py
│   │   │   └── settings.py         # Includes logo upload endpoint
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── client.py
│   │   │   ├── document.py
│   │   │   ├── line_item.py
│   │   │   ├── service_template.py
│   │   │   └── settings.py
│   │   ├── schemas/                # Pydantic v2 schemas
│   │   ├── services/               # Business logic
│   │   │   ├── pdf_generator.py
│   │   │   └── number_generator.py
│   │   ├── main.py                 # FastAPI app + static file mount
│   │   ├── database.py             # DB connection + engine
│   │   ├── config.py               # Environment settings
│   │   └── seed.py                 # Sample data + service templates
│   ├── alembic/                    # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ClientCombobox.tsx   # Searchable client picker + inline creation
│   │   │   ├── ServiceManager.tsx   # Service template CRUD dialog
│   │   │   ├── LogoUpload.tsx       # File upload or URL + preview
│   │   │   ├── Layout.tsx           # Sidebar navigation
│   │   │   ├── Toaster.tsx
│   │   │   └── ui/                 # shadcn/ui primitives
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── ClientDetail.tsx
│   │   │   ├── Documents.tsx
│   │   │   ├── DocumentDetail.tsx
│   │   │   ├── DocumentForm.tsx     # Offerte/Rechnung form with service picker
│   │   │   └── Settings.tsx         # Tabbed: Company, Bank, Defaults, Services
│   │   ├── lib/
│   │   │   ├── api.ts              # API client (all endpoints)
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── use-dark-mode.ts
│   │   │   └── use-toast.tsx
│   │   └── types/index.ts          # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
├── SPEC.md
└── README.md
```

## API Endpoints

### Clients
| Method | Endpoint                 | Description               |
|--------|--------------------------|---------------------------|
| GET    | `/api/clients`           | List all clients          |
| GET    | `/api/clients/{id}`      | Get client with documents |
| POST   | `/api/clients`           | Create client             |
| PUT    | `/api/clients/{id}`      | Update client             |
| DELETE | `/api/clients/{id}`      | Delete client             |

### Documents (Offerte + Rechnung)
| Method | Endpoint                       | Description                      |
|--------|--------------------------------|----------------------------------|
| GET    | `/api/documents`               | List (filter by type/status)     |
| GET    | `/api/documents/{id}`          | Get document with line items     |
| POST   | `/api/documents`               | Create with line items           |
| PUT    | `/api/documents/{id}`          | Update document + line items     |
| DELETE | `/api/documents/{id}`          | Delete document                  |
| POST   | `/api/documents/{id}/convert`  | Convert Offerte → Rechnung       |
| PATCH  | `/api/documents/{id}/status`   | Update status                    |
| GET    | `/api/documents/{id}/pdf`      | Download PDF                     |

### Services
| Method | Endpoint               | Description                    |
|--------|------------------------|--------------------------------|
| GET    | `/api/services`        | List services (filter by category, active) |
| POST   | `/api/services`        | Create service template        |
| PUT    | `/api/services/{id}`   | Update service template        |
| DELETE | `/api/services/{id}`   | Delete service template        |

### Other
| Method | Endpoint                 | Description               |
|--------|--------------------------|---------------------------|
| GET    | `/api/dashboard`         | Dashboard stats            |
| GET    | `/api/settings`          | Get company settings       |
| PUT    | `/api/settings`          | Update company settings    |
| POST   | `/api/settings/logo`     | Upload company logo file   |
| GET    | `/api/health`            | Health check               |
| POST   | `/api/seed`              | Seed sample data           |
| GET    | `/api/sso/apps`          | Platform apps for the switcher (R-103) |
| GET    | `/api/sso/launch?app=…`  | Mint SSO token, return hand-off URL |

## Document Workflow

```
Offerte:   Draft → Sent → Accepted → Convert to Rechnung
                        → Rejected
                        → Cancelled

Rechnung:  Draft → Sent → Paid
                        → Overdue
                        → Cancelled
```

## Extending

- **New fields**: SQLAlchemy model → Pydantic schema → TypeScript type → UI
- **New document types**: Add to `document_type` check constraint and status rules
- **New PDF templates**: Create functions in `pdf_generator.py`
- **New services**: Add via UI (Settings → Services tab) or in `seed.py`
- **Migrations**: `alembic revision --autogenerate -m "description"`
- **MwSt/VAT**: Add `vat_rate` and `vat_amount` fields to documents and line items

## Storage

Logo uploads go through a `StorageBackend` (`backend/app/services/storage.py`, R-90).

| Variable | Default | Notes |
|---|---|---|
| `STORAGE_BACKEND` | `local` | `local` or `s3` |
| `S3_BUCKET` | | required for `s3` |
| `S3_ENDPOINT_URL` | | leave empty for AWS; set for MinIO / R2 / Hetzner |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | | empty = boto3 default credential chain |
| `S3_REGION` | | |
| `S3_PUBLIC_BASE_URL` | derived | public URL prefix for objects (CDN or bucket URL) |

`local` writes to `backend/uploads/` and serves it at `/uploads` from the app
itself. That directory is not shared between containers, so **run with more
than one app replica only with `STORAGE_BACKEND=s3`** (any S3-compatible
bucket; `boto3` is imported only when selected).

## Background jobs

Overdue marking and recurring invoices run as scheduled jobs
(`backend/app/services/jobs.py`), one pass every `JOBS_INTERVAL_SECONDS`
(default 3600). A Postgres advisory lock guarantees exactly one process
executes a pass, whatever the topology.

| Setting | Default | Notes |
|---|---|---|
| `RUN_JOBS_IN_API` | `true` | API runs the jobs in-process — local dev (`scripts/dev.sh`) and single-container setups |
| `JOBS_INTERVAL_SECONDS` | `3600` | seconds between passes |

`docker-compose.yml` sets `RUN_JOBS_IN_API=false` on `backend` and runs the
jobs in the dedicated `jobs` service (`python -m app.jobs`, same image), so
job uptime is not tied to API restarts and a slow pass never blocks requests
(R-84). To run a single pass by hand (cron, smoke test):

```bash
cd backend && python -m app.jobs --once
# or in Docker
docker compose run --rm jobs python -m app.jobs --once
```

## Platform (SSO + events)

billing is product 1 of 2 in the ChaDev platform and the **identity issuer**
(chadev-platform/docs/ADR-001-sso.md). Two integrations with buchhaltung,
both off until the platform variables are set:

- **SSO hand-off (R-103, contracts/sso.md).** `GET /api/sso/apps` lists the
  products the top-bar app switcher may show (empty when unconfigured).
  `GET /api/sso/launch?app=buchhaltung` mints a 120 s single-use HS256 token
  (`iss=billing`, `aud=buchhaltung`, `type=sso`, user + tenant snapshot) signed
  with `PLATFORM_SHARED_SECRET` and returns `{"url": "<BUCHHALTUNG_URL>/sso#token=…"}`;
  the browser navigates there and buchhaltung exchanges the fragment for its
  own session. Unconfigured = both routes answer 404.
- **Outbound events (R-104, contracts/events.md).** When a Rechnung
  transitions to `paid`, an `invoice.paid` row is written to the durable
  `outbound_events` table in the same transaction. Delivery is
  `POST <BUCHHALTUNG_API_URL>/api/platform/events`, HMAC-SHA256 signed
  (`X-Platform-Signature`, `X-Platform-Timestamp`, `X-Platform-Delivery`),
  attempted once right after the change and then by the scheduled-jobs pass
  with backoff 1 min → 5 → 30 → 2 h → 24 h (6 attempts; a 404 `unknown_tenant`
  is final). `/api/health` shows `"events": {"pending", "failed"}` outside
  production. Unconfigured = events are recorded but never sent.

| Variable | Default | Notes |
|---|---|---|
| `PLATFORM_SHARED_SECRET` | | same value in both `.env` files; signs SSO tokens + event HMAC; separate from `SECRET_KEY` |
| `BUCHHALTUNG_URL` | `http://localhost:3000` (compose) | browser-facing buchhaltung URL: switcher target + SSO redirect base |
| `BUCHHALTUNG_API_URL` | `http://host.docker.internal:8000` (compose) | server-to-server base for events; `http://localhost:8000` when uvicorn runs on the host |

`docker-compose.yml` maps `host.docker.internal` to the host gateway on
`backend` and `jobs`, so the default API URL resolves on Linux as well.

## Deployment

See `billing-deployment-guide.md` for full instructions on deploying to a Hostinger VPS with Docker, Nginx, SSL, and the `chadev.space` domain.

## License

Private — ChaDev internal use.
