import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.logging_config import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"
# A proxy may forward its own id; anything longer is not one we want in logs.
MAX_REQUEST_ID_LEN = 128


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Take the caller's X-Request-ID or mint one, expose it to logging and
    echo it back so a user-reported id can be matched to server lines."""

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER, "").strip()
        request_id = incoming[:MAX_REQUEST_ID_LEN] or uuid.uuid4().hex
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
