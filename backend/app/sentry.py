"""Optional Sentry error monitoring (roadmap 4.2).

Enabled only when SENTRY_DSN is set. sentry_sdk is imported lazily so the
package stays optional at runtime: an install without it still boots as long
as the DSN is empty.
"""

import logging

logger = logging.getLogger(__name__)


def configure_sentry(dsn: str, env: str) -> bool:
    """Initialise Sentry. Returns True when it was actually enabled."""
    if not dsn:
        return False
    try:
        import sentry_sdk
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; errors will not be reported")
        return False

    # The FastAPI/Starlette integrations are auto-enabled by sentry-sdk when
    # those packages are importable, so no explicit integration list here.
    sentry_sdk.init(
        dsn=dsn,
        environment=env,
        send_default_pii=False,
        traces_sample_rate=0.0,
    )
    return True
