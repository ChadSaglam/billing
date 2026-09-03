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

## Tech Stack

| Layer    | Technology                                                    |
|----------|---------------------------------------------------------------|
| Backend  | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Alembic |
| Frontend | React 19 · TypeScript · Vite 7 · Tailwind CSS v3 · shadcn/ui (Radix) |
| Database | PostgreSQL 16                                                 |
| PDF      | ReportLab · qrcode (Swiss QR-bill)                            |
| Infra    | Docker Compose                                                |

---

## Quick Start (Docker)

```bash
cd billing

# Build and start all services
docker-compose up --build

# Seed the database with sample clients, invoices, and service templates
curl -X POST http://localhost:8001/api/seed
```

Open your browser:

| Service       | URL                           |
|---------------|-------------------------------|
| Frontend      | http://localhost:5173          |
| Backend API   | http://localhost:8001          |
| API Docs      | http://localhost:8001/docs     |

### Rebuild after code changes

```bash
docker-compose down -v          # -v removes volumes (resets database)
docker-compose up --build
curl -X POST http://localhost:8001/api/seed
```

> **Note:** Services (16 templates) are auto-seeded on startup. The `/api/seed` endpoint creates sample clients and invoices.

---
## Quick Start (Local)

From the project root:

```bash
./scripts/local-dev.sh
```

This starts:
- PostgreSQL connectivity checks
- FastAPI backend
- Vite frontend

Open:

| Service     | URL |
|-------------|-----|
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:8002 |
| API Docs    | http://localhost:8002/docs |

Run the smoke tests in another terminal:

```bash
BACKEND_PORT=8002 ./scripts/local-test.sh
```
---
## Seed sample data

The seed endpoint requires authentication. First register or log in, then call `/api/seed` with a bearer token.

### Register a local user

```bash
curl -X POST http://localhost:8002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"***REMOVED***","password":"***REMOVED***","full_name":"Chad Saglam","company_name":"ChaDev"}'
```

### Log in

```bash
TOKEN=$(curl -sf -X POST http://localhost:8002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"***REMOVED***","password":"***REMOVED***"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### Run seed

```bash
curl -X POST http://localhost:8002/api/seed \
  -H "Authorization: Bearer $TOKEN"
```
---

## Development without Docker

### Prerequisites

- Python 3.13
- Node.js + npm
- PostgreSQL running locally on `localhost:5432`
- A project `.env` file at the repo root

### Start everything

```bash
./scripts/local-dev.sh
```

### Run checks

```bash
BACKEND_PORT=8002 ./scripts/local-test.sh
```

### Stop everything

Press `Ctrl+C` in the terminal running `local-dev.sh`.

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

## Deployment

See `billing-deployment-guide.md` for full instructions on deploying to a Hostinger VPS with Docker, Nginx, SSL, and the `chadev.space` domain.

## License

Private — ChaDev internal use.
