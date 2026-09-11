"""Uniform error envelope + request correlation (R-27).

Every non-2xx response carries the same shape, so every log line can be tied
back to the request that produced it:

    {"detail": "...", "error": {"code": "http_404", "message": "...", "request_id": "..."}}

`detail` is FastAPI's default field and what the frontend parses today; the
`error` object is an additive extension. Validation errors keep FastAPI's
`detail` list and gain `error.fields`.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"
_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def current_request_id() -> str:
    return _request_id.get()


def error_body(code: str, message: str, *, detail: object | None = None, **extra: object) -> dict:
    """Build the envelope. `detail` defaults to the message (backward compatible)."""
    error: dict[str, object] = {"code": code, "message": message, "request_id": current_request_id()}
    error.update(extra)
    return {"detail": message if detail is None else detail, "error": error}


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a request id, time the request and emit one structured access log."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:16]
        token = _request_id.set(rid)
        request.state.request_id = rid
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration = (time.perf_counter() - start) * 1000
            logger.exception(
                "unhandled request error",
                extra={
                    "extra_fields": {
                        "request_id": rid,
                        "method": request.method,
                        "path": request.url.path,
                        "duration_ms": round(duration, 1),
                    }
                },
            )
            _request_id.reset(token)
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "error": {"code": "internal_error", "message": "Internal server error", "request_id": rid},
                },
                headers={REQUEST_ID_HEADER: rid},
            )
        duration = (time.perf_counter() - start) * 1000
        response.headers[REQUEST_ID_HEADER] = rid
        response.headers["Server-Timing"] = f"app;dur={duration:.1f}"
        logger.info(
            "request",
            extra={
                "extra_fields": {
                    "request_id": rid,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round(duration, 1),
                }
            },
        )
        _request_id.reset(token)
        return response


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http_exc(request: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        headers = {REQUEST_ID_HEADER: current_request_id(), **(exc.headers or {})}
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(f"http_{exc.status_code}", message, detail=exc.detail),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exc(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        fields = [
            {"field": ".".join(str(p) for p in err.get("loc", ())[1:]), "message": err.get("msg", "")} for err in errors
        ]
        return JSONResponse(
            status_code=422,
            # FastAPI's `detail` list is not JSON-safe as-is (ctx may hold exceptions).
            content=error_body(
                "validation_error",
                "Validation failed",
                detail=jsonable_encoder(errors, custom_encoder={Exception: str}),
                fields=fields,
            ),
            headers={REQUEST_ID_HEADER: current_request_id()},
        )
