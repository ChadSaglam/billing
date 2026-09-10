# ROADMAP — Billing (ChaDev Platform · product 1 of 2)

> One running list. Never duplicated — items move between sections, they don't get re-added.
> Legend: severity `C`ritical / `H`igh / `M`edium / `L`ow · effort `S` (<1h) / `M` (half day) / `L` (multi-day)
> IDs: `R-xx` = work item (next free: **R-101**) · `P-xx` = parked idea (next free: **P-07**)
> Cross-product items (SSO, contracts, design tokens) live in `chadev-platform/ROADMAP.md`, not here.
> Updated: 2026-09-10

---

## 🎯 North star — what "done" looks like

| Owner's words | What it means in this repo | Tracks that deliver it |
|---|---|---|
| **more dynamic** | UI reacts without reload: live dashboard, optimistic updates, real-time status | R-60, R-24, R-59, P-03 |
| **more professional** | Invoices that are legally correct in every currency/rounding case, branded emails + portal, i18n | R-68, R-49, R-72, R-61, R-25, R-87 |
| **easier to improve** | No god-files, one type source, shared helpers, tests that catch regressions, docs that match code | R-46, R-47, R-48, R-85, R-21, R-78, R-79, R-63 |
| **more user-friendly** | Onboarding checklist, loading/empty/error states everywhere, keyboard-first, a11y, portal actions | R-62, R-24, R-23, R-88 |

Rule: every PR names the R-ID it closes and which north-star column it serves.

---

## 🔥 NOW — do these in order (one at a time)

- [ ] **R-35** `test.pdf` and `test_export.csv` are tracked at the repo root — test artifacts in version control. — `L` / `S`
      **Reopened 2026-09-04: still committed (26,170 B / 2,399 B). `git rm` + already gitignored.**
- [ ] **R-67** `send_document_email_endpoint` passes ORM objects (`doc`, `company`) into a
      BackgroundTask — after `db.commit()` and session close they are expired → DetachedInstanceError
      in production. Extract plain values before queueing. Tests pass today only because TestClient
      keeps the session alive. — `H` / `S`
      `backend/app/api/documents.py` · `backend/app/services/email_sender.py`
- [ ] **R-68** PDF hardcodes `CHF` on every line item and totals row in **both** templates, while
      `document.currency` can be EUR (R-12). Printed invoices can show the wrong currency —
      legal-document bug. — `H` / `S`
      `backend/app/services/pdf_generator.py`

---

## ⏭ NEXT — "easier to improve" foundation (order matters: helpers → splits → types)

- [ ] **R-96** Drop the legacy top-level `detail` from error responses in **2.6.0** (contract:
      chadev-platform/contracts/errors.md). No first-party reader left after R-94; flag in release notes. — `M` / `S`
      `backend/app/core/errors.py` · `backend/app/limiter.py`
- [ ] **R-46** Split `documents.py` (661 lines — 4× the next-largest router). Slices, tests green
      after each: 1) helpers (`_build_line_item`, `_recalc_totals`, `_get_doc`, `_load_full`,
      `_get_settings`, `_calc_next_recurrence`) → `services/document_service.py` · 2) routes → CRUD /
      status+convert / pdf+email / bulk+export. — `H` / `L`
- [ ] **R-47** Split `pdf_generator.py` (660 lines): classic/modern templates ~80 % duplicated.
      1) shared body-builder + `_fmt`/`_fmt_date`/`_build_styles` → `pdf/layout.py`, template = style pack
      · 2) `_add_qr_bill_page` → `pdf/qr_slip.py` · 3) thin dispatcher. Prereq for R-25 and R-68. — `H` / `L`
- [ ] **R-85** Two sources of truth for API types: hand-written `frontend/src/types/index.ts` (209 lines)
      next to generated `api.generated.ts` (2,633 lines). Make `index.ts` re-export/alias from the
      generated file only; add `npm run generate-api` freshness check to CI. — `M` / `M`
      `frontend/src/types/index.ts` · `.github/workflows/ci.yml`
- [ ] **R-86** `GET /api/clients` and `/api/documents` return `list | Page` depending on `?page`
      (R-13 compatibility shim). Dual response shape = weak contract and confuses generated types.
      **Contract change:** always return the envelope; migrate the comboboxes. — `M` / `M`
      `backend/app/api/clients.py:14` · `backend/app/api/documents.py`
- [ ] **R-71** Duplicate `(tenant_id, document_number)` → unhandled IntegrityError → 500 instead of 409,
      on create / duplicate / convert paths. One exception handler + test. — `M` / `S`
- [ ] **R-73** `bulk_send_email` sends SMTP synchronously in-request while single-send uses
      BackgroundTasks → timeouts on bulk. Unify on the background path (needs R-67 first). — `M` / `S`
- [ ] **R-74** `preview_pdf` mutates `settings.pdf_template` in-session and relies on `db.expire`.
      Pass template as an argument instead. — `L` / `S`
- [ ] **R-77** Swiss cross in the QR code drawn with per-pixel `putpixel` loops —
      `PIL.ImageDraw.rectangle` does it in ~6 lines. — `L` / `S`
- [ ] **R-19b** Verify `test.sh` / `project-overview.sh` no longer hardcode 5173/8001. — `L` / `S`

---

## 📋 LATER — by track

### Security & data protection (gate before the first external tenant)

- [ ] **R-15b** httpOnly SameSite cookies for the refresh token. Decision record first
      (CSRF surface vs. XSS blast radius), then implement. — `H` / `M`
      `SECURITY.md` · `frontend/src/lib/api.ts` · `frontend/src/lib/auth.ts`
- [ ] **R-83b** Decision: Postgres RLS with `SET LOCAL app.tenant_id` as defence in depth behind the
      `scoped()` helper (R-83 step 2; platform 2.5). Decision record first, then migration. — `H` / `L`
      `backend/app/database.py` · `backend/alembic/`
- [ ] **R-53** Portal attack-surface review — the only public unauthenticated surface: token entropy
      (48 B urlsafe — OK), **no expiry**, enumeration resistance, per-IP throttling. — `H` / `M`
      `backend/app/api/portal.py`
- [ ] **R-65** CSV formula injection in `export_documents_csv`: cells starting with `= + - @` or tab
      execute in Excel. Prefix-escape text cells. — `M` / `S`
- [ ] **R-76** CSV export has no required date bound and joinedloads items+client for the full
      history → memory spike. Require a date range (or stream with `yield_per`). — `M` / `S`
- [ ] **R-75** `/api/health` exposes disk usage + migration revision unauthenticated — needed by CI
      (R-41); trim to status+db when `APP_ENV=production`; add `version` + `storage` backend. — `L` / `S`
- [ ] **R-55** Backup/restore script + documented restore drill. — `H` / `M`
- [ ] **R-56** FK `ondelete` + NOT NULL audit for tenant cascades. — `M` / `M`
      `backend/app/models/`

### Money logic correctness

- [ ] **R-98** Money rounding is `ROUND_HALF_EVEN` (Decimal default) in `_build_line_item` and
      `_recalc_totals`; Swiss commercial rounding is `ROUND_HALF_UP` (0.405 → 0.41, 3.525 → 3.53).
      Switch both quantize calls, flip the two strict xfails in `test_totals.py`, note in release
      notes that historical totals may differ by 1 Rp. — `H` / `S`
      `backend/app/api/documents.py`
- [ ] **R-99** `line_items.quantity` is `Numeric(10,2)`: a 3-decimal quantity (1.235 kg) is stored
      rounded to 1.24 while `total_price` was computed from 1.235, so the printed line no longer
      multiplies out. Either validate to 2 decimals in the schema (422) or widen to `Numeric(10,3)`
      with a migration. Strict xfail in `test_totals.py`. — `M` / `S`
      `backend/app/models/line_item.py` · `backend/app/schemas/document.py`
- [ ] **R-52** Invoice number race test: concurrent creates under one tenant. Prove `FOR UPDATE` holds. — `H` / `M`
- [ ] **R-57** Recurring-invoice idempotency under scheduler retry / double-run. — `H` / `S`
- [ ] **R-87** Configurable document-number format per tenant (prefix, year, zero-padding,
      e.g. `RE-2026-0042`). Today: bare integer counter. Expected by every Swiss accountant. — `H` / `M`
      `backend/app/services/number_generator.py` · `backend/app/models/settings.py`

### Performance ("dynamic" needs a fast backend)

- [ ] **R-26** N+1 query audit (dashboard, document list, bulk actions) → `selectinload`/`joinedload`. — `M` / `M`
- [ ] **R-58** Index audit: composite indexes for the status/date filters the document list uses. — `M` / `S`
- [ ] **R-82** `get_current_user` does 2 extra queries per request (User, then Tenant). Join or
      `joinedload(User.tenant)`. — `L` / `S`
      `backend/app/auth.py:86-92`
- [ ] **R-84** Background jobs (overdue, recurring) run inside the API process via asyncio loop.
      Advisory lock makes it safe, but job uptime = API uptime and a slow job blocks the event loop
      thread pool. Move to a separate `python -m app.jobs` container in compose. — `M` / `M`
      `backend/app/main.py:61-91`
- [ ] **R-59** Route-level code splitting (lazy pages) + bundle budget check in CI. — `M` / `M`

### UX / a11y / frontend ("dynamic, professional, user-friendly")

- [ ] **R-24** Loading / empty / error states audit across all 10 pages. Known: `OnboardingGate`
      returns `null` (blank screen) while fetching; verify `['settings']` invalidation in `Onboarding.tsx`. — `M` / `M`
- [ ] **R-60** Live dashboard widgets: overdue aging, month revenue, open quotes — TanStack
      `refetchInterval` now, websocket later (P-03). — `M` / `M`
- [ ] **R-62** Guided onboarding checklist on the dashboard (`onboarding_completed` exists). — `M` / `M`
- [ ] **R-61** Branded emails + portal with tenant logo. — `M` / `M`
- [ ] **R-88** Client portal actions: accept/reject Offerte, see all documents of the client, not one
      token per document. Turns the portal from a download link into a product surface. — `M` / `L`
      `backend/app/api/portal.py` · `frontend/src/pages/Portal.tsx`
- [ ] **R-25** i18n DE/EN first, FR/IT-ready — UI, PDF labels (after R-47), portal, emails. — `M` / `L`
- [ ] **R-23** a11y pass: focus traps, ARIA on DataTable, keyboard path through DocumentForm;
      axe-core in Playwright. — `M` / `L`
- [ ] **R-29** Status history (JSONB, migration `f7978eefd0b8`) surfaced as a timeline in DocumentDetail. — `L` / `M`

### Testing & reliability

- [ ] **R-100** Playwright: portal (public token link) and multi-tenant isolation specs on top of
      the R-22 happy path. — `M` / `M`
      `frontend/e2e/`

### DX & tooling

- [ ] **R-78** `SPEC.md` describes the pre-multi-tenant app (no tenants/users/refresh_tokens/VAT/plans,
      old ports, "Add tenant_id" listed as future work). Either regenerate from models + OpenAPI or
      delete and point to `/docs`. A wrong spec is worse than none. — `H` / `M`
- [ ] **R-79** `README.md` references files that don't exist (`scripts/local-dev.sh`,
      `scripts/local-test.sh`, `billing-deployment-guide.md`), ports 8001/8002, and an unauthenticated
      seed call. Rewrite Quick Start around `scripts/dev.sh` + `.env.example`. — `M` / `S`
- [ ] **R-80** `frontend/package.json`: name `frontend-tmp`; `shadcn` CLI in runtime deps; both the
      `radix-ui` meta-package and individual `@radix-ui/*` installed. — `L` / `S`
- [ ] **R-81** CI hygiene: installs cairo/pango libs that R-18 removed; `ruff format` is
      `continue-on-error`; model/migration drift check only warns. Make all three strict. — `M` / `S`
      `.github/workflows/ci.yml:49-55,68,78`
- [ ] **R-63** Pre-commit hooks: ruff + eslint + gitleaks. — `M` / `S`
- [ ] **R-64** PR template with R-ID + north-star column + test-plan checklist. — `L` / `S`
- [ ] **R-30** Soft-delete for documents (Swiss retention rules). — `H` / `M`

---

## 🅿️ Parked (off-topic, pulled back when the current task is closed)

- **P-01** Stripe subscription billing for the SaaS itself — after security gate (R-15b, R-83b, R-53).
- **P-02** Public REST API + API keys — after R-48 helpers exist.
- **P-03** WebSocket live updates — only if R-60 polling feels stale.
- **P-04** Payment links on invoices (TWINT / card) — after QR-bill proven in production.
- **P-05** Multi-currency beyond CHF/EUR — R-12 covers realistic Swiss cases.
- **P-06** Payment reconciliation: import camt.054 / match QR reference → auto mark paid. — `H` / `L`

---

## ✅ Done

- **R-22** ✅ 2026-09-10 — `e2e/billing-flow.spec.ts` is a real happy path: register a tenant via UI → onboarding → client → two-line Rechnung (asserts CHF 270.25) → Vorschau (`/preview` 200 `application/pdf`) → `/pdf` with the session token. `playwright.config.ts` fixed for ESM (`__dirname` crashed before any test). CI job `e2e`: Postgres service, `alembic upgrade head`, uvicorn :8000, Playwright with its own Vite dev server. Portal/multi-tenant specs continue as R-100.
- **R-21** ✅ 2026-09-10 — vitest 4.1.11 (`npm run test`, in the frontend CI job). 21 tests in `src/test/`: `lib/errors.ts` fallback chain, `line-item-utils` (`calculateTotals`/`lineTotal` extracted from `LineItemsEditor`), `lib/optimistic.ts` rollback.
- **R-72** ✅ 2026-09-10 — `_esc()` + `_Escaped` proxy in `pdf_generator.py`: names, addresses, UID, notes and QR-slip text are XML-escaped before `Paragraph`. "Bold <b> Bauer" no longer 500s and "<Holding>" is printed instead of dropped. pypdf added to dev requirements for text assertions.
- **R-70** ✅ 2026-09-10 — `duplicate_document` derives `due_date` only when `payment_terms_days` is set.
- **R-69** ✅ 2026-09-10 — `update_document` no longer crashes on `payment_terms_days=null`, keeps an explicitly sent `due_date`; `DocumentRead`/`PortalDocumentRead` declare the field nullable (it was already nullable in the DB). `api.generated.ts` regenerated.
- **R-66** ✅ 2026-09-10 — `update_document` always recalculates totals from the stored items; a discount-only PUT is persisted correctly. Test in `test_document_edits.py`.
- **R-49** ✅ 2026-09-10 — Rounding matrix in `test_totals.py` (multi-rate 8.1/2.6/0, discount before VAT, per-line VAT rounding pinned, half-cent cases, empty document). `services/money.py::round_to_5_rappen()` helper + tests — **not** applied to document totals (QR-bill amounts keep the cent). Findings opened as R-98 (half-even vs half-up) and R-99 (3-decimal quantity).
- **R-51** ✅ 2026-09-10 — `tests/test_qr_reference.py` (28): ISO 11649 vector `RF18539007547034`, independent MOD 97-10 check, sanitization, `validate_creditor_reference()`, recursive MOD10 (`21000000000313947143000901` → 7) via new `mod10_recursive()`/`generate_qr_reference()` (QRR, not wired into the PDF — needs a QR-IBAN, `is_qr_iban()` added), EUR vs CHF in the SPC payload. **Bug fixed:** references over 25 characters were generated for long document numbers; body is now capped at 21. Backend tests after R-51/R-49/R-66…R-72: 58 → **112** passed + 3 strict xfails.
- **R-83** ✅ 2026-09-10 — Step 1: `tests/test_tenant_scoping_guard.py` parses every `db.query()` in `app/api/*.py` on a model with a `tenant_id` column and fails unless it goes through `scoped()`/`get_or_404()` or filters `tenant_id ==` itself (allowlist with reasons: email/jti/portal-token lookups). Step 2 (RLS) continues as R-83b. Tests 56 → **58**.
- **R-48** ✅ 2026-09-10 — `services/tenancy.py`: `scoped(db, Model, tenant_id)` + `get_or_404()`; clients, services, settings, users, dashboard, documents migrated with identical SQL. Error shape is already uniform via the R-27 envelope; a paginated-response wrapper is not needed while both paginated lists share the R-13 shape.
- **R-92b** ✅ 2026-09-10 — `tenant_or_ip_key()`: `tenant:<tid>` from a valid access token, else `ip:<addr>`. Document create/pdf/preview/send-email, bulk ×3 and logo upload at `120/minute` per tenant; auth routes stay per IP. Limiter keyed by endpoint, not URL, so `/{id}/pdf` shares one bucket. Tests 51 → **56**.
- **R-95** ✅ 2026-09-10 — Test that the 500 envelope carries `error.code=internal_error` + `detail` and hides the exception text. Tests 50 → **51**.
- **R-94** ✅ 2026-09-10 — Frontend reads `error.message` via `lib/errors.ts` (`getApiErrorMessage`/`getRequestId`); every direct `detail` read replaced, global toast appends `(Ref: <request_id>)` on 5xx. Unblocks dropping `detail`.
- **R-92** ✅ 2026-09-10 — slowapi 429 in the envelope: `error.code=rate_limited` + `retry_after`, `Retry-After` header, legacy `detail`. Per-tenant keys still open. Tests 49 → **50**.
- **R-93** ✅ 2026-09-10 — Access token carries `role` + `jti` (platform auth contract, additive). Tests 48 → **49**.
- **R-42** ✅ 2026-09-10 — `react-router-dom` ^6.30 → ^7.18 (only `BrowserRouter/Routes/Link/useNavigate/useParams/useLocation` used, no API change). `npm audit` = 0 vulnerabilities. tsc · lint · build green; e2e to be run by owner.
- **R-89** ✅ 2026-09-09 — `/docs`, `/redoc`, `/openapi.json` disabled when `APP_ENV=production`. 4 tests.
- **R-27** ✅ 2026-09-09 — JSON logging, `X-Request-ID` + `Server-Timing`, uniform error envelope
  (`detail` kept **and** `error:{code,message,request_id}` added — additive, non-breaking). `print()` gone. 5 tests.
- **R-91** ✅ 2026-09-09 — Sentry via `SENTRY_DSN` (lazy import, off by default).
- **R-90** ✅ 2026-09-09 — `services/storage.py`: `StorageBackend` (local | s3) behind `STORAGE_BACKEND`;
  logo upload routed through it. README "Storage" section. Tests 33 → **48**.

- **R-01…R-10** CI, security pipeline, test scaffold, per-tenant uniqueness, no default IBAN, header auth,
  RBAC, seed gate, safe logo upload, Alembic-only schema.
- **R-11…R-18** Plans/trials, per-tenant VAT+currency, pagination, advisory-locked jobs, token risk
  documented, rotating refresh tokens, auth rate limits, dependency cleanup. — PR #41, #42
- **R-19, R-20, R-31…R-34, R-36…R-41, R-43** Ports, prod Dockerfile, server-side totals, unified limiter,
  dead `user.py` removed, compose fixed, origins parsing, tenant-scoped numbering, scripts consolidated,
  CVE backlog, migration baseline, venv pinning. — PR #43
- **R-28** ✅ Closed 2026-09-04 — already done: `backend/Dockerfile` runs as `appuser`, entrypoint drops
  `--reload` when `APP_ENV=production`.
- **R-54** ✅ Closed 2026-09-04 — already done: `ci.yml` runs `alembic downgrade -1 && upgrade head` on
  an ephemeral Postgres per PR.
- **R-45** Code audit (2026-09-04): 10 prior fixes verified, 13 findings R-65…R-77 logged.
- **Phase 0 re-recon (2026-09-04, this session):** repo re-read at `fc9fce7`; added R-78…R-88, P-06;
  reopened R-42; closed R-28, R-54.

---

## Phase progress

| Phase | Topic | Status |
|---|---|---|
| 0 | Recon / system map | ✅ done (re-verified 2026-09-04) |
| 0.5 | Risk fixes before platform work | ✅ R-89, R-27, R-91, R-90 (branch `feat/phase0-risks`, 2026-09-09) |
| 1 | Architecture & code quality | audit done (R-45), R-48 helpers ✅, R-66 ✅ · NEXT: R-46 → R-47 → R-85 → R-86 |
| 2 | Security & data protection | core done, R-83 step 1 + R-92b ✅; open: R-15b, R-83b, R-53, R-65, R-75, R-76, R-55, R-56 |
| 3 | Performance | not started: R-26, R-58, R-82, R-84, R-59 |
| 4 | UX / a11y / frontend | not started: R-24, R-60, R-62, R-61, R-88, R-25, R-23, R-29 |
| 5 | Testing & reliability | R-21, R-22, R-49, R-51 ✅; open: R-52, R-57, R-98, R-99, R-100 |
| 6 | DX & tooling | CI/docker/scripts done; open: R-78, R-79, R-80, R-81, R-63, R-64, R-30 |
| 4b | Observability | ✅ R-92 · open: R-75, R-84 |
