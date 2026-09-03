"""Single shared rate limiter.

Both `main.py` (which registers it on `app.state` and wires the 429 handler)
and the routers that decorate endpoints must use the SAME instance —
otherwise limits, storage backend and the enabled flag diverge.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
