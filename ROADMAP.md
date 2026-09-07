# ROADMAP — billing

> Billing-only slice of the ChaDev platform roadmap. Item numbers (2.1, 4.1, …) match the platform ROADMAP so the two lists can be cross-referenced. Updated: 2026-09-07
> Rule: one task at a time. Each `[ ]` is ~20 min. Effort: S < 1h · M < 4h · L > 4h

---

## NOW

**Current phase:** R0 production hardening → PR `fix/r0-prod-hardening` open against `main`
**Next action:** Review + merge the PR, then set `LOG_LEVEL` / `SENTRY_DSN` on the prod host and confirm `/docs` returns 404 there.

---

## Phase 1 — Platform contract — M

- [ ] 1.2 Adopt the shared JWT shape `{sub, tid, role, type, exp, jti}` + role set `owner|admin|editor|viewer` (S)
- [ ] 1.3 Uniform error body `{"error":{code,message,request_id}}` (M) — **API contract change, flag in CHANGELOG**
- [ ] 1.5 SSO direction: billing issues tokens, buchhaltung verifies with shared `SECRET_KEY`/JWKS (S, decision only)

## Phase 2 — Security & tenant isolation — M

- [x] 2.1 Hide `/docs` `/redoc` `/openapi.json` when `APP_ENV=production` (S)
- [ ] 2.3 Audit every router for `tenant_id` from token only — grep `tenant_id` in request bodies (M)
- [x] 2.4 Logo upload — MIME sniff + size cap + filename randomization (S, was R-09)
- [ ] 2.5 Rate limits on login/register/refresh; check `slowapi` keys per tenant not per IP only (S)

## Phase 3 — Reliability & tests — L

- [ ] 3.3 Tests for QR-reference checksum + VAT totals edge cases (S)
- [ ] 3.4 Vitest for 3 critical FE utils (line-item-utils, errors.ts) (M)
- [ ] 3.5 Playwright happy path (login → create invoice → PDF) (M)

## Phase 4 — Professional polish (logging, errors, observability) — M

- [x] 4.1 Replace `print()` with `logging` + request-id middleware (S)
- [x] 4.2 Sentry via `SENTRY_DSN` env (S)
- [ ] 4.3 Move background jobs to a `worker` compose service (M)
- [x] 4.4 Uploads behind a `StorageBackend` interface, local + S3 (M)
- [ ] 4.5 `/api/health` returns `version`, `db`, `migration_head`, `storage` (S)

## Phase 5 — Dynamic & user-friendly UX — L

- [ ] 5.1 Introduce `i18n.ts` (DE default, EN second) reusing buchhaltung pattern (M)
- [ ] 5.3 Shared design tokens so both apps look like one brand (M)
- [ ] 5.4 Loading / empty / error states audit — every page has all three (M)
- [ ] 5.5 a11y pass — focus trap in dialogs, ARIA on DataTable, keyboard shortcut help (M)

## Phase 6 — Together: cross-product features — L

- [ ] 6.1 SSO: log in once, switch product via top-bar app switcher (M)
- [ ] 6.2 Paid invoice → POST booking to buchhaltung (`webhook.py` exists there) (M)
- [ ] 6.4 Shared plan/billing (Stripe vs Lemon Squeezy — parked decision) (L)
- [ ] 6.5 One onboarding: create tenant once, enable products as modules (M)

## Phase 7 — Developer experience — S

- [ ] 7.1 Add `Makefile` mirroring buchhaltung (`setup/dev/check/fix/api-types`) (S)
- [ ] 7.2 `AGENTS.md` (copy buchhaltung's, adapt) (S)
- [ ] 7.4 pre-commit hooks — ruff, prettier, api-types freshness (S)
- [ ] 7.5 `scripts/project-overview.sh` output → auto-updates a `STATUS.md` (S)

---

## LATER (parked)

- Multi-currency
- `ruff format` clean-up of the 29 pre-existing unformatted files (CI runs the check with `continue-on-error`)
- boto3 in a `requirements-s3.txt` extra once an S3 deployment exists
- Client portal branding per tenant

---

## DONE

- [x] 2.1 `/docs` `/redoc` `/openapi.json` off in production, `Settings.is_production` (2026-09-07, `fix/r0-prod-hardening`)
- [x] 4.1 `logging` everywhere, `X-Request-ID` middleware + contextvar in log format, `LOG_LEVEL` (2026-09-07, same branch)
- [x] 4.2 Optional Sentry via `SENTRY_DSN`, lazy `sentry_sdk` import (2026-09-07, same branch)
- [x] 4.4 `StorageBackend` protocol, `LocalStorage` + `S3Storage`, logo upload refactored (2026-09-07, same branch)
- [x] Earlier: R-01…R-43 security/ops fixes (see git history up to PR #43)

---

## SESSION HANDOFF (paste at start of next session)

```
STATE: R0 hardening done on branch fix/r0-prod-hardening, PR open to main.
REPO:  github.com/ChadSaglam/billing
DONE:  2.1 docs hidden in prod · 4.1 logging + X-Request-ID · 4.2 Sentry · 4.4 StorageBackend (local/s3)
TESTS: backend/ `ruff check app tests` green · `pytest` 51 passed (Postgres required)
OPEN:  merge PR · set LOG_LEVEL/SENTRY_DSN in prod .env · 4.5 health endpoint fields · 1.3 error shape
NEXT ACTION: review + merge PR, then 4.5 (S).
```
