# ChaDev Billing — Offerte & Rechnungen Software

## Overview

A billing/invoicing application for **ChaDev**, a Swiss web development consultancy.
Designed for SaaS-readiness — modular, extensible, and usable by other companies.

- **Backend**: FastAPI (Python 3.12) + SQLAlchemy 2.0 + Pydantic v2 + PostgreSQL 16
- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS v3 + shadcn/ui (Radix primitives)
- **PDF**: ReportLab for invoice PDFs with Swiss QR-bill payment slips
- **Docker**: docker-compose with PostgreSQL, FastAPI backend, Vite dev frontend
- **Logo**: File upload (`/api/settings/logo`) or URL input, served via FastAPI StaticFiles mount

## Business Details (seeded as defaults in company_settings)

| Field                | Value                                    |
|----------------------|------------------------------------------|
| Company              | ChaDev                                   |
| Address              | Hohlstrasse 485A, 8048 Zürich            |
| UID                  | ***REMOVED***                          |
| Bank                 | Migros Bank AG                           |
| IBAN                 | ***REMOVED***               |
| BIC/Swift            | MIGRCHZZXXX                              |
| Email                | info@chadev.ch                           |
| Phone                | ***REMOVED***                         |
| Website              | www.chadev.ch                            |
| Default hourly rate  | 250.00 CHF                               |
| Default payment terms| 30 days                                  |

---

## Database Schema (PostgreSQL)

### clients

| Column          | Type                    | Constraints / Default              |
|-----------------|-------------------------|-------------------------------------|
| id              | SERIAL                  | PRIMARY KEY                         |
| customer_number | VARCHAR(20)             | UNIQUE NOT NULL                     |
| company_name    | VARCHAR(255)            | NOT NULL                            |
| contact_person  | VARCHAR(255)            | NULLABLE                            |
| email           | VARCHAR(255)            | NULLABLE                            |
| phone           | VARCHAR(50)             | NULLABLE                            |
| street          | VARCHAR(255)            | NOT NULL                            |
| postal_code     | VARCHAR(10)             | NOT NULL                            |
| city            | VARCHAR(100)            | NOT NULL                            |
| country         | VARCHAR(100)            | DEFAULT 'Schweiz'                   |
| notes           | TEXT                    | NULLABLE                            |
| created_at      | TIMESTAMP               | DEFAULT NOW()                       |
| updated_at      | TIMESTAMP               | DEFAULT NOW()                       |

### documents (used for both Offerte and Rechnung)

| Column              | Type           | Constraints / Default                                                   |
|---------------------|----------------|-------------------------------------------------------------------------|
| id                  | SERIAL         | PRIMARY KEY                                                             |
| document_type       | VARCHAR(20)    | NOT NULL, CHECK IN ('offerte', 'rechnung')                              |
| document_number     | VARCHAR(20)    | UNIQUE NOT NULL                                                         |
| client_id           | INT            | REFERENCES clients(id)                                                  |
| date                | DATE           | NOT NULL                                                                |
| due_date            | DATE           | NULLABLE (calculated from payment_terms_days)                           |
| payment_terms_days  | INT            | DEFAULT 30                                                              |
| status              | VARCHAR(20)    | DEFAULT 'draft', CHECK IN ('draft','sent','accepted','rejected','paid','overdue','cancelled') |
| subtotal            | DECIMAL(12,2)  | DEFAULT 0                                                               |
| discount_percent    | DECIMAL(5,2)   | DEFAULT 0                                                               |
| discount_amount     | DECIMAL(12,2)  | DEFAULT 0                                                               |
| total               | DECIMAL(12,2)  | DEFAULT 0                                                               |
| currency            | VARCHAR(3)     | DEFAULT 'CHF'                                                           |
| notes               | TEXT           | NULLABLE                                                                |
| converted_from_id   | INT            | NULLABLE, REFERENCES documents(id)                                      |
| created_at          | TIMESTAMP      | DEFAULT NOW()                                                           |
| updated_at          | TIMESTAMP      | DEFAULT NOW()                                                           |

**Status rules:**
- Offerte: draft, sent, accepted, rejected, cancelled
- Rechnung: draft, sent, paid, overdue, cancelled

### line_items

| Column       | Type           | Constraints / Default                           |
|--------------|----------------|--------------------------------------------------|
| id           | SERIAL         | PRIMARY KEY                                      |
| document_id  | INT            | REFERENCES documents(id) ON DELETE CASCADE       |
| position     | INT            | NOT NULL                                         |
| description  | VARCHAR(500)   | NOT NULL                                         |
| quantity     | DECIMAL(10,2)  | NOT NULL, DEFAULT 1                              |
| unit_price   | DECIMAL(12,2)  | NOT NULL                                         |
| total_price  | DECIMAL(12,2)  | NOT NULL (quantity * unit_price)                  |
| unit         | VARCHAR(50)    | DEFAULT 'Stunde'                                 |
| created_at   | TIMESTAMP      | DEFAULT NOW()                                    |

### service_templates

| Column       | Type           | Constraints / Default                           |
|--------------|----------------|--------------------------------------------------|
| id           | SERIAL         | PRIMARY KEY                                      |
| name         | VARCHAR(255)   | NOT NULL                                         |
| description  | TEXT           | NULLABLE                                         |
| category     | VARCHAR(100)   | NOT NULL                                         |
| unit_price   | DECIMAL(12,2)  | NOT NULL                                         |
| unit         | VARCHAR(50)    | DEFAULT 'Stunde'                                 |
| is_active    | BOOLEAN        | DEFAULT true                                     |
| sort_order   | INT            | DEFAULT 0                                        |
| created_at   | TIMESTAMP      | DEFAULT NOW()                                    |
| updated_at   | TIMESTAMP      | DEFAULT NOW()                                    |

### company_settings

| Column                      | Type           | Constraints / Default   |
|-----------------------------|----------------|--------------------------|
| id                          | SERIAL         | PRIMARY KEY              |
| company_name                | VARCHAR(255)   |                          |
| street                      | VARCHAR(255)   |                          |
| postal_code                 | VARCHAR(10)    |                          |
| city                        | VARCHAR(100)   |                          |
| country                     | VARCHAR(100)   |                          |
| uid                         | VARCHAR(50)    |                          |
| bank_name                   | VARCHAR(255)   |                          |
| iban                        | VARCHAR(50)    |                          |
| bic                         | VARCHAR(50)    |                          |
| email                       | VARCHAR(255)   |                          |
| phone                       | VARCHAR(50)    |                          |
| website                     | VARCHAR(255)   |                          |
| default_hourly_rate         | DECIMAL(12,2)  |                          |
| default_payment_terms_days  | INT            |                          |
| logo_url                    | VARCHAR(500)   | NULLABLE                 |
| next_invoice_number         | INT            | DEFAULT 1326             |
| next_offerte_number         | INT            | DEFAULT 2001             |

---

## API Endpoints (FastAPI)

### Clients
- `GET    /api/clients`              — List all clients (with search/filter)
- `GET    /api/clients/{id}`         — Get client details with related documents
- `POST   /api/clients`              — Create client
- `PUT    /api/clients/{id}`         — Update client
- `DELETE /api/clients/{id}`         — Delete client

### Documents (Offerte + Rechnung)
- `GET    /api/documents`            — List documents (filter by type, status, client, date range)
- `GET    /api/documents/{id}`       — Get document with line items
- `POST   /api/documents`            — Create document with line items
- `PUT    /api/documents/{id}`       — Update document and line items
- `DELETE /api/documents/{id}`       — Delete document
- `POST   /api/documents/{id}/convert` — Convert Offerte → Rechnung (copies all data, links via converted_from_id)
- `PATCH  /api/documents/{id}/status` — Update document status
- `GET    /api/documents/{id}/pdf`   — Generate and download PDF

### Services (Templates)
- `GET    /api/services`             — List service templates (filter by category, active_only)
- `POST   /api/services`            — Create service template
- `PUT    /api/services/{id}`       — Update service template
- `DELETE /api/services/{id}`       — Delete service template

### Dashboard
- `GET    /api/dashboard`            — Summary stats (total revenue, outstanding, recent activity, overdue count)

### Settings
- `GET    /api/settings`             — Get company settings
- `PUT    /api/settings`             — Update company settings
- `POST   /api/settings/logo`       — Upload company logo (multipart file upload, saved to /uploads/logos/)

### System
- `GET    /api/health`               — Health check
- `POST   /api/seed`                 — Seed sample clients and invoices

---

## UI Pages (React)

### 1. Dashboard (`/`)
- Overview cards: Total Revenue (paid), Outstanding (sent), Overdue count, Client count
- Monthly revenue chart
- Recent documents table
- Quick action buttons: New Offerte, New Rechnung

### 2. Clients (`/clients`)
- Searchable table: Customer Nr, Company, Contact, City, Actions
- Click row → client detail page
- Create/Edit client dialog

### 3. Client Detail (`/clients/:id`)
- Client info card
- Tabs: All Documents, Offerten, Rechnungen
- Table of related documents with status badges

### 4. Documents (`/documents`)
- Tabs: All, Offerten, Rechnungen
- Filters: status, date range, client
- Table: Number, Type, Client, Date, Total, Status, Actions
- Status badges with colors

### 5. Document Detail (`/documents/:id`)
- Document header info
- Line items table
- Action buttons: Edit, Send, Mark Paid, Download PDF, Convert to Rechnung (for Offerte)
- Status timeline

### 6. Create/Edit Document (`/documents/new`, `/documents/:id/edit`)
- Type selector (Offerte/Rechnung)
- **ClientCombobox** — searchable dropdown with inline "Create New Client" dialog
- Date picker + payment terms
- Service catalog picker (select from templates to auto-fill line items)
- Dynamic line items (add/remove rows) with live total calculation
- Discount (percentage) with auto-calculated amount
- Notes field
- **"Manage Services" button** → opens ServiceManager dialog

### 7. Settings (`/settings`)
- **Tabbed layout** with 4 sections:
  - **Company Info** — Name, address, UID, email, phone, website + LogoUpload
  - **Bank Details** — Bank name, IBAN, BIC
  - **Defaults** — Default hourly rate, payment terms, next invoice/offerte number
  - **Services** — Full ServiceManager (add/edit/delete/toggle active)

---

## Key Components

### ClientCombobox
- Popover + Command (cmdk) combobox with fuzzy search
- Shows all clients in a scrollable list
- "Create New Client" button opens an inline dialog
- New client is created via API, then auto-selected in the form

### ServiceManager
- Dialog with full CRUD for service templates
- Add new service: name, description, category, unit price, unit
- Edit/delete existing services
- Toggle active/inactive per service
- Categories: Webentwicklung, Beratung, Wartung & Support, Design, Spezialleistungen

### LogoUpload
- Dual mode: upload a file (POST to `/api/settings/logo`) or enter a URL
- Live preview of the uploaded/entered logo
- File uploads saved to `/app/uploads/logos/` (Docker volume for persistence)

---

## UI Design Direction

- **SaaS/productivity** style: Clean, professional, functional
- **Color**: Teal accent (from Nexus palette), neutral warm surfaces
- **Font**: Inter for body, semibold for headings
- **Dark mode**: Supported with toggle
- Sidebar navigation with icons
- Status badges: Draft=gray, Sent=blue, Accepted/Paid=green, Rejected/Overdue=red, Cancelled=gray-muted
- Currency always shown as "CHF"
- Swiss date format: DD.MM.YYYY
- German-language invoice PDFs (formal business German)

---

## PDF Invoice Format

Based on actual ChaDev invoices:

1. Company logo area (ChaDev header)
2. Client address block (left) | Invoice details (right: Nr, Datum, Kundennummer, UID)
3. Location + Date line
4. "Rechnung Nr. XXXX" heading
5. Formal greeting: "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag."
6. Line items table: Pos, Bezeichnung/Beschreibung, Menge, Preis/Stück, Positionspreis
7. Zwischensumme, optional Preisnachlass (discount), Rechnungsbetrag
8. Payment note: "Wir bitten Sie um Überweisung des Rechnungsbetrages innerhalb von X Tagen."
9. "Mit freundlichen Grüssen, ChaDev"
10. Footer: Company details, bank info, contact
11. Page 2: Swiss QR-bill payment slip

---

## Service Templates (16 pre-seeded)

| Category               | Services                                                                |
|------------------------|-------------------------------------------------------------------------|
| Webentwicklung         | Website Erstellung, Webseiten Redesign, Landingpage, E-Commerce Shop   |
| Beratung               | Beratungsgebühr, IT Consulting, SEO Beratung                           |
| Wartung & Support      | Technischer Kundendienst, System Aktualisierung, Hosting & Domain      |
| Design                 | Logo & Branding, UI/UX Design, Grafik Design                           |
| Spezialleistungen      | API Integration, Datenbank Migration, Schulung & Workshop              |

---

## Seed Data (from actual invoices)

### Client: Ammann + Schmid AG
- customer_number: 90014
- company_name: Ammann + Schmid AG
- street: Freiestrasse 39, 8610 Uster

### Client: RDS Isolierungen GmbH
- customer_number: 90012
- company_name: RDS Isolierungen GmbH
- street: Grüzefeldstrasse 51, 8404 Winterthur

### Client: Sky - Net Logistik GmbH
- customer_number: 90025
- company_name: Sky - Net Logistik GmbH
- street: Bösch 21, 6331 Hünenberg
- email: info@sky-net-logistik.ch

### Invoice 1011 (Ammann + Schmid AG, 15.12.2023)
1. Erstellt Kontaktseite einige Details Teil | 1h | 250 CHF | 250 CHF
2. Stilisierung der Kontaktseite / Styling Öffnungszeiten | 1h | 250 CHF | 250 CHF
3. Responsive Probleme beendet | 3h | 250 CHF | 750 CHF
4. 404 Seite erstellt | 1h | 250 CHF | 250 CHF
- **Total: 1'500 CHF** — Status: paid

### Invoice 1012 (RDS Isolierungen GmbH, 15.12.2023)
1. Webseiten | 1 | 500 CHF | 500 CHF
2. Beratungsgebühr (Stunde) | 1h | 250 CHF | 250 CHF
3. System Aktualisierung (Stunde) | 2h | 250 CHF | 500 CHF
- **Total: 1'250 CHF** — Status: paid

### Invoice 1325 (Sky - Net Logistik GmbH, 29.06.2025)
1. Technischer Kundendienst (Stunde) | 10h | 250 CHF | 2'500 CHF
2. Beratungsgebühr (Stunde) | 4h | 250 CHF | 1'000 CHF
- Subtotal: 3'500 CHF, Discount: 13% (455 CHF)
- **Total: 3'045 CHF** — Status: sent, Payment terms: 10 days

---

## Extending

- **New fields**: SQLAlchemy model → Pydantic schema → TypeScript type → UI
- **New document types**: Add to `document_type` check constraint and status rules
- **New PDF templates**: Create new functions in `pdf_generator.py`
- **New services**: Add via UI (Settings → Services) or programmatically in `seed.py`
- **Migrations**: `alembic revision --autogenerate -m "description"`
- **MwSt/VAT**: Add `vat_rate` and `vat_amount` fields to documents and line items
- **Multi-tenant**: Add `tenant_id` to all models + auth layer for SaaS distribution

---

## Docker Volumes

| Volume    | Purpose                                           |
|-----------|---------------------------------------------------|
| `pgdata`  | PostgreSQL data persistence                       |
| `uploads` | Company logo files (`/app/uploads/logos/`)        |

## Environment Variables

```env
# Backend
DATABASE_URL=postgresql://chadev:chadev@db:5432/chadev_billing

# Frontend
VITE_API_URL=http://localhost:8000
```

## License

Private — ChaDev internal use.
