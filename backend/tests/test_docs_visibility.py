"""/docs, /redoc and /openapi.json are off in production (2.1).

The `app` object is built at import time from `app.config.settings`, so each
case executes main.py as a fresh module with a patched Settings instead of
reloading `app.main` underneath the shared test client.
"""

import importlib.util
import pathlib

import pytest
from fastapi.testclient import TestClient

import app.config
from app.config import Settings

_MAIN = pathlib.Path(__file__).resolve().parents[1] / "app" / "main.py"
DOC_PATHS = ("/docs", "/redoc", "/openapi.json")


def _load_app(monkeypatch, app_env: str):
    monkeypatch.setenv("APP_ENV", app_env)
    monkeypatch.setattr(app.config, "settings", Settings(_env_file=None))
    spec = importlib.util.spec_from_file_location(f"main_{app_env}", _MAIN)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


@pytest.mark.parametrize(("app_env", "expected"), [("production", True), ("development", False)])
def test_is_production(monkeypatch, app_env, expected):
    monkeypatch.setenv("APP_ENV", app_env)
    assert Settings(_env_file=None).is_production is expected


def test_docs_hidden_in_production(monkeypatch):
    fastapi_app = _load_app(monkeypatch, "production")
    assert fastapi_app.openapi_url is None
    client = TestClient(fastapi_app)
    for path in DOC_PATHS:
        assert client.get(path).status_code == 404, path


def test_docs_served_in_development(monkeypatch):
    fastapi_app = _load_app(monkeypatch, "development")
    client = TestClient(fastapi_app)
    for path in DOC_PATHS:
        assert client.get(path).status_code == 200, path
