"""API docs are hidden when APP_ENV=production (R-89).

`app` is built at import time, so the production variant is obtained by
flipping the setting and reloading `app.main`; the module is reloaded again
afterwards so the rest of the suite keeps the development app.
"""
import importlib

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.config import settings


@pytest.fixture
def production_app(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    try:
        yield importlib.reload(main_module).app
    finally:
        monkeypatch.undo()
        importlib.reload(main_module)


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_docs_hidden_in_production(production_app, path):
    # No lifespan (plain client, no `with`): the jobs need a database.
    assert TestClient(production_app).get(path).status_code == 404


def test_docs_served_outside_production():
    assert settings.APP_ENV != "production"
    assert TestClient(main_module.app).get("/docs").status_code == 200
