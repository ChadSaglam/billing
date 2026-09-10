"""Single shared rate limiter.

Both `main.py` (which registers it on `app.state` and wires the 429 handler)
and the routers that decorate endpoints must use the SAME instance —
otherwise limits, storage backend and the enabled flag diverge.
"""
import logging
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.errors import REQUEST_ID_HEADER, current_request_id, error_body

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

RATE_LIMITED_MESSAGE = "Too many requests, try again later"


def _seconds_until_reset(request: Request) -> int | None:
    """Seconds until the exceeded window resets, or None if slowapi did not
    record which limit was hit (e.g. the handler is invoked outside a
    decorated endpoint)."""
    current = getattr(request.state, "view_rate_limit", None)
    if not current:
        return None
    try:
        reset_at, _remaining = limiter.limiter.get_window_stats(current[0], *current[1])
    except Exception:  # storage unreachable — a missing hint beats a 500
        logger.warning("rate limit window stats unavailable", exc_info=True)
        return None
    return max(1, int(reset_at - time.time()) + 1)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 in the R-27 envelope (R-92) instead of slowapi's `{"error": "<str>"}`.

    `detail` mirrors the message like every other handler; `Retry-After`
    is set whenever the reset time is known.
    """
    retry_after = _seconds_until_reset(request)
    extra = {"retry_after": retry_after} if retry_after is not None else {}
    headers = {REQUEST_ID_HEADER: current_request_id()}
    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)
    response = JSONResponse(
        status_code=429,
        content=error_body("rate_limited", RATE_LIMITED_MESSAGE, **extra),
        headers=headers,
    )
    # Adds X-RateLimit-* when `headers_enabled` is on; keeps our Retry-After.
    return limiter._inject_headers(response, getattr(request.state, "view_rate_limit", None))
