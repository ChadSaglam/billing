"""configure_sentry("") is a no-op that never imports the SDK (R-91)."""

import sys

from app.core.sentry import configure_sentry


def test_empty_dsn_does_not_import_sentry_sdk(monkeypatch):
    monkeypatch.delitem(sys.modules, "sentry_sdk", raising=False)
    # Any attempt to import the SDK would raise from this sentinel.
    monkeypatch.setitem(sys.modules, "sentry_sdk", None)
    configure_sentry("")
    configure_sentry(None)
