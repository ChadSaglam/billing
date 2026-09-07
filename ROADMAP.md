# ROADMAP — billing (part of ChaDev Platform)

> Canonical multi-repo roadmap lives in chadev-platform. This is the billing-scoped mirror.
> Updated: 2026-09-07 · Effort: S < 1h · M < 4h · L > 4h

---

## NOW

**Current phase:** Phase 1 — Platform contract — IN PROGRESS
**Branch:** `feat/phase1-platform-contract`
**Next action:** Awaiting D2 (SSO direction) confirm, then implement 1.3 error contract adoption.

---

## D1 — DECIDED

**B — Separate repos + shared platform contract.**

## D2 — PENDING (SSO direction)

Proposal (see chadev-platform contracts/auth.md): billing issues JWTs (already has access+refresh+jti), buchhaltung verifies via shared `SECRET_KEY` (HS256) now, JWKS/RS256 later in Phase 6.

---

## Phase 0 — System map ✅

| | billing | buchhaltung |
|---|---|---|
| Purpose | Offerte/Rechnungen, QR-bill PDF, client portal | Receipt/bank-statement scan → AI classification → Banana export |
| Backend | FastAPI, sync SQLAlchemy, psycopg2 | FastAPI, async SQLAlchemy, asyncpg (+SQLite dev) |
| Auth | JWT access+refresh (revocable jti), roles admin/editor/viewer, trial gate | JWT, role owner only, plan free |
| Tenant | tenants(subscription_plan, trial_ends_at, is_active) | tenants(plan) only |
| Errors | Default FastAPI {"detail"} | Uniform {"error":{code,message,request_id}} + Sentry |
| Tests | 29 backend · 1 e2e · 0 unit FE | 6 backend · 1 e2e smoke · 0 unit FE |
| Size | 4.5k py · 10k ts | 7k py · 11.6k ts |

**Biggest risks (billing):**
1. /docs + /openapi.json open in production. [Medium]
2. print() logging in jobs, no request-id, no Sentry. [Medium]
3. Uploads (logos) on local disk → breaks with >1 replica. [Medium]

---

## Phase 1 — Platform contract — M — IN PROGRESS (billing tasks)

- [x] Contract drafts reviewed: contracts/errors.md, contracts/auth.md (chadev-platform) (S)
- [ ] 1.3a Add exception handlers mirroring buchhaltung's core/errors.py: map HTTPException, RequestValidationError, unhandled Exception → {"error":{code,message,request_id}} (M) — **breaking API change, flag in CHANGELOG**
- [ ] 1.3b Add request-id middleware (X-Request-Id generate/propagate) (S)
- [ ] 1.3c Regenerate api.generated.ts (openapi-typescript) after error shape change (S)
- [ ] 1.3d Update tests/Playwright expecting old {"detail"} shape (M)
- [ ] 1.5 D2: confirm SSO issuing side (billing issues, shared SECRET_KEY) — **awaiting your reply**

## Phase 2 — Security & tenant isolation — M (billing tasks)

- [ ] 2.1 Hide /docs /redoc /openapi.json when APP_ENV=production (S)
- [ ] 2.3 Audit every router for tenant_id from token only (M)
- [ ] 2.4 Logo upload — MIME sniff + size cap + filename randomization (S)
- [ ] 2.5 Rate limits on login/register/refresh, per tenant not per IP (S)

## Phase 3 — Reliability & tests — L (billing tasks)

- [ ] 3.3 Tests for QR-reference checksum + VAT totals edge cases (S)
- [ ] 3.4 Vitest for critical FE utils (M)
- [ ] 3.5 Playwright happy path: login → create → PDF (M)

## Phase 4 — Professional polish — M (billing tasks)

- [ ] 4.1 Replace print() with logging + request-id middleware (S)
- [ ] 4.2 Sentry via SENTRY_DSN env (S)
- [ ] 4.3 Background jobs to worker compose service (M)
- [ ] 4.4 Uploads to S3-compatible storage behind StorageBackend interface (M)
- [ ] 4.5 /api/health returns version, db, migration_head, storage (S)

## Phase 5 — Dynamic & user-friendly UX — L (billing tasks)

- [ ] 5.1 Introduce i18n.ts (DE default, EN second) reusing buchhaltung pattern (M)
- [ ] 5.3 Adopt shared design tokens (M)
- [ ] 5.4 Loading/empty/error states audit (M)
- [ ] 5.5 a11y pass (M)

## Phase 6 — Together: cross-product features — L (billing tasks)

- [ ] 6.1 SSO: log in once, switch product via top-bar app switcher (M)
- [ ] 6.2 Paid invoice → POST booking to buchhaltung (webhook.py exists there) (M)
- [ ] 6.4 Shared plan/billing (Stripe vs Lemon Squeezy) (L)
- [ ] 6.5 One onboarding: create tenant once, enable products as modules (M)

## Phase 7 — Developer experience — S (billing tasks)

- [ ] 7.1 Add Makefile mirroring buchhaltung (setup/dev/check/fix/api-types) (S)
- [ ] 7.2 AGENTS.md (copy buchhaltung's, adapt) (S)
- [ ] 7.4 Pre-commit hooks (S)

---

## DONE

- [x] Phase 0 Recon (2026-09-07)
- [x] D1 decided — Option B (2026-09-07)
- [x] Branch feat/phase1-platform-contract created (2026-09-07)
- [x] Reviewed chadev-platform contract drafts (2026-09-07)

---

## SESSION HANDOFF

```
STATE: Phase 1 in progress. Contracts drafted on chadev-platform. Awaiting D2 (SSO direction).
NEXT ACTION: confirm D2, then implement 1.3 error contract adoption (breaking change, flag CHANGELOG).
```
