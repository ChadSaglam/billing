"""SSO hand-off, issuer side (R-103, chadev-platform/contracts/sso.md).

billing is the platform identity issuer (ADR-001). `GET /api/sso/launch`
mints a short-lived, single-use SSO token for the target app and hands the
browser a URL whose *fragment* carries it — the fragment never reaches a
server log. The target app exchanges it for its own session.

Everything here is gated on `PLATFORM_SHARED_SECRET` + the target URL: when
either is unset the routes answer 404, so an unconfigured install exposes
no SSO surface at all.
"""
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt

from app.auth import get_current_user
from app.config import settings
from app.limiter import limiter
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/api/sso", tags=["sso"])

SSO_ISSUER = "billing"
SSO_TOKEN_TTL_SECONDS = 120
SSO_ALGORITHM = "HS256"

# contracts/auth.md ladder. billing issues admin | editor | viewer; `owner`
# is accepted verbatim so a future owner role needs no change here.
ROLE_LADDER = ("owner", "admin", "editor", "viewer")


def platform_role(role: str | None) -> str:
    """Map a billing role onto the platform ladder; unknown = least privilege."""
    return role if role in ROLE_LADDER else "viewer"


def tenant_snapshot(tenant: Tenant) -> dict:
    """The `tenant` claim: what buchhaltung mirrors on first use (Phase 6.5)."""
    trial_ends = tenant.trial_ends_at
    return {
        "name": tenant.name,
        "slug": tenant.slug,
        "subscription_plan": tenant.subscription_plan,
        "trial_ends_at": (
            trial_ends.replace(microsecond=0, tzinfo=None).isoformat() + "Z" if trial_ends else None
        ),
    }


def create_sso_token(user: User, tenant: Tenant, *, audience: str, secret: str) -> str:
    """Mint the SSO token exactly as contracts/sso.md specifies.

    Same style as `create_access_token`, but signed with the platform secret
    (never the app's own SECRET_KEY) and only 120 s long. `jti` is 32 hex so
    the receiver can remember it for single use.
    """
    now = int(datetime.now(UTC).timestamp())
    payload = {
        "iss": SSO_ISSUER,
        "aud": audience,
        "type": "sso",
        "sub": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "tid": tenant.id,
        "role": platform_role(user.role),
        "tenant": tenant_snapshot(tenant),
        "iat": now,
        "exp": now + SSO_TOKEN_TTL_SECONDS,
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm=SSO_ALGORITHM)


def configured_apps() -> list[dict]:
    """Apps the switcher may offer. Unconfigured = absent, so no dead link."""
    if not settings.PLATFORM_SHARED_SECRET or not settings.BUCHHALTUNG_URL:
        return []
    return [{"id": "buchhaltung", "name": "Buchhaltung", "url": settings.BUCHHALTUNG_URL.rstrip("/")}]


@router.get("/apps")
def list_apps(user: User = Depends(get_current_user)) -> list[dict]:
    """Switcher entries; an empty list when SSO is not configured."""
    return configured_apps()


@router.get("/launch")
@limiter.limit("30/minute")
def launch(request: Request, app: str, user: User = Depends(get_current_user)) -> dict:
    """Mint an SSO token for `app` and return the URL the browser navigates to.

    404 (uniform envelope) for an unknown app or an unconfigured platform —
    deliberately the same answer, so nothing reveals which apps exist.
    """
    target = next((entry for entry in configured_apps() if entry["id"] == app), None)
    if target is None or not settings.PLATFORM_SHARED_SECRET:
        raise HTTPException(status_code=404, detail="SSO target not available")

    token = create_sso_token(
        user, user.tenant, audience=target["id"], secret=settings.PLATFORM_SHARED_SECRET
    )
    return {"url": f"{target['url']}/sso#token={token}"}
