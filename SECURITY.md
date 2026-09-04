# Security notes

Running log of deliberate security decisions. For the engineering backlog
see ROADMAP.md.

## Accepted risk: tokens in `localStorage` (R-15)

**Decision (2026-09-04): accepted for now, revisit before the first external
tenant.**

Access and refresh tokens live in `localStorage`, which means a successful
XSS could exfiltrate them. Moving to httpOnly cookies is the correct end
state but is a multi-day change on its own (cookie-based refresh flow, CSRF
protection, axios `withCredentials`, login/register/refresh rewrites) —
doing it halfway would be worse than documenting it.

Why the residual risk is tolerable today:

- **Single-use, revocable refresh tokens (R-16).** Every `/api/auth/refresh`
  rotates and retires the presented token, so a stolen refresh token dies
  the first time either party uses it; `/api/auth/logout` revokes on demand.
  The pre-R-16 nightmare — a stolen token valid for 30 days — is gone.
- **Access tokens expire in 30 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Output encoding everywhere:** React escapes by default, and anything
  rendered into a PDF or email goes through bleach
  (`app/services/sanitizer.py`).
- **No third-party scripts** on authenticated pages.
- **Rate limiting on every auth endpoint (R-17):** register 5/min,
  login 10/min, refresh + logout 30/min.

Trigger to revisit: first external/customer tenant, or any finding from the
security pipeline that implies XSS — then implement httpOnly
`SameSite=Lax` cookies plus a CSRF token, and delete this section.
