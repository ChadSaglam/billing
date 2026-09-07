"""configure_sentry is a no-op without a DSN and never imports the SDK then (4.2)."""

import sys

from app.sentry import configure_sentry


def test_empty_dsn_is_noop(monkeypatch):
    # A poisoned module proves the import is never attempted.
    monkeypatch.setitem(sys.modules, "sentry_sdk", None)
    assert configure_sentry("", "production") is False


def test_missing_sdk_is_tolerated(monkeypatch):
    monkeypatch.setitem(sys.modules, "sentry_sdk", None)  # None -> ImportError
    assert configure_sentry("https://key@sentry.example/1", "production") is False


def test_dsn_initialises_sdk(monkeypatch):
    calls = {}

    class FakeSdk:
        @staticmethod
        def init(**kwargs):
            calls.update(kwargs)

    monkeypatch.setitem(sys.modules, "sentry_sdk", FakeSdk)
    assert configure_sentry("https://key@sentry.example/1", "production") is True
    assert calls["dsn"] == "https://key@sentry.example/1"
    assert calls["environment"] == "production"
