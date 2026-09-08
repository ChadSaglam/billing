# ROADMAP — billing (part of ChaDev Platform)

> Canonical multi-repo roadmap lives in chadev-platform. This is the billing-scoped mirror.
> Updated: 2026-09-08 · Effort: S < 1h · M < 4h · L > 4h

---

## NOW

**Current phase:** Phase 2 — Security & tenant isolation — IN PROGRESS
**Branch:** `feat/phase1-platform-contract` (same branch, continued)
**Next action:** 2.3 tenant_id audit, 2.5 rate limits

---

## D1 / D2 — DECIDED

D1 = B. D2 = billing issues JWTs, buchhaltung verifies via shared SECRET_KEY (HS256) now, JWKS later.

---

## Phase 0 ✅ / Phase 1 ✅ DONE

See PR #56.

---

## Phase 2 — Security & tenant isolation — M — IN PROGRESS (billing tasks)

- [x] 2.1 Hide /docs /redoc /openapi.json when APP_ENV=production (S) — **CONFIRMED DONE in PR #55** (`Settings.is_production`, `docs_url=None` etc. in main.py, tests in test_docs_visibility.py)
- [ ] 2.3 Audit every router for tenant_id from token only — grep tenant_id in request bodies, confirm every query filters by `get_tenant_id()` dependency not a client-supplied field (M)
- [x] 2.4 Logo upload — MIME sniff + size cap + filename randomization (S) — **CONFIRMED DONE in PR #55** (StorageBackend, uuid4 filenames, content-sniffed via PIL, tests in test_uploads.py/test_storage.py)
- [ ] 2.5 Rate limits on login/register/refresh; check slowapi keys are per-tenant not per-IP only (S) — backend/app/limiter.py exists, needs review of key_func

## Phase 1 carryover (implementation, tracked here)

- [ ] 1.3a Exception handlers -> {"error":{code,message,request_id}} (M) — breaking change, flag CHANGELOG
- [ ] 1.3c Regenerate api.generated.ts (S)
- [ ] 1.3d Update tests/Playwright expecting old {"detail"} shape (M)

## Phase 3 — Reliability & tests — L

- [ ] 3.3 Tests for QR-reference checksum + VAT totals edge cases (S)
- [ ] 3.4 Vitest for critical FE utils (M)
- [ ] 3.5 Playwright happy path: login → create → PDF (M)

## Phase 4 — Professional polish — M

- [x] 4.1 Replace print() with logging + request-id middleware (S) — **DONE in PR #55**
- [x] 4.2 Sentry via SENTRY_DSN env (S) — **DONE in PR #55**
- [ ] 4.3 Background jobs to worker compose service (M)
- [x] 4.4 Uploads to S3-compatible storage (M) — **DONE in PR #55**
- [ ] 4.5 /api/health returns version, db, migration_head, storage (S)

## Phase 5 — Dynamic & user-friendly UX — L

- [ ] 5.1 Introduce i18n.ts (DE default, EN second) (M)
- [ ] 5.3 Adopt shared design tokens (M)
- [ ] 5.4 Loading/empty/error states audit (M)
- [ ] 5.5 a11y pass (M)

## Phase 6 — Together: cross-product features — L

- [ ] 6.1 SSO app switcher (M)
- [ ] 6.2 Paid invoice → POST booking to buchhaltung (M)
- [ ] 6.4 Shared plan/billing provider (L)
- [ ] 6.5 One onboarding (M)

## Phase 7 — Developer experience — S

- [ ] 7.1 Add Makefile mirroring buchhaltung (S)
- [ ] 7.2 AGENTS.md (copy buchhaltung's, adapt) (S)
- [ ] 7.4 Pre-commit hooks (S)

---

## DONE

- [x] Phase 0 Recon (2026-09-07)
- [x] Phase 1 complete — contracts reviewed, PR #56 open (2026-09-07)
- [x] 2.1 docs guard, 2.4 upload hardening, 4.1 logging, 4.2 Sentry, 4.4 storage — all confirmed done in PR #55 (2026-09-08)

---

## SESSION HANDOFF

```
STATE: Phase 2 in progress. 2.1/2.4/4.1/4.2/4.4 confirmed done via PR #55 diff review.
PRs: billing#56 (this branch), billing#55 (r0 hardening, separate branch)
OPEN: 2.3 tenant_id audit (grep + manual review), 2.5 rate limit key_func review, 1.3 error contract.
NEXT ACTION: read backend/app/limiter.py and backend/app/api/*.py contents to do 2.3/2.5 (blocked this session — GitHub connector returned metadata only, not file text).
```
