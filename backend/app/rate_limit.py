"""Single shared rate limiter.

There must be exactly one Limiter instance in the app: the @limiter.limit
decorators and app.state.limiter have to be the same object, or the counters
live in separate buckets and the limits silently do nothing.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
