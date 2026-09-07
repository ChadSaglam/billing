"""Process-wide logging setup (roadmap 4.1).

Every record carries the current request id so one request's lines can be
grepped together across workers. The id lives in a contextvar, set by
`RequestContextMiddleware`, and reads "-" outside a request (startup,
background jobs).
"""

import logging
import sys
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

FORMAT = "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    # Idempotent: uvicorn --reload and the test suite import main.py more
    # than once, and each import must not add another handler.
    if getattr(root, "_billing_configured", False):
        root.setLevel(level.upper())
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FORMAT))
    handler.addFilter(RequestIdFilter())
    root.handlers = [handler]
    root.setLevel(level.upper())
    root._billing_configured = True

    # uvicorn installs its own handlers; route them through ours so the
    # access log gets the same shape and request id.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv = logging.getLogger(name)
        uv.handlers = []
        uv.propagate = True
