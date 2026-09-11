"""`/api/health` contract (R-75) — consumed unauthenticated by CI and the
compose healthcheck, so the key set is a contract."""

import importlib

from fastapi.testclient import TestClient

import app.main as main_module
from app.config import settings

CONTRACT_KEYS = {"status", "version", "database", "migration", "storage", "jobs"}


def test_health_reports_database(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "degraded")
    assert body["database"] == "connected"


def test_health_contract_keys(client):
    body = client.get("/api/health").json()
    assert CONTRACT_KEYS <= body.keys()
    assert body["version"] == main_module.app.version
    assert body["migration"] not in ("none", "unknown")
    assert body["storage"] == settings.STORAGE_BACKEND
    assert body["jobs"] == "in-api"


def test_health_reports_worker_when_jobs_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "RUN_JOBS_IN_API", False)
    assert client.get("/api/health").json()["jobs"] == "worker"


def test_health_disk_usage_outside_production(client):
    assert settings.APP_ENV != "production"
    body = client.get("/api/health").json()
    assert "disk" in body


def test_health_hides_disk_usage_in_production(monkeypatch, db):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    try:
        prod_app = importlib.reload(main_module).app
        prod_app.dependency_overrides[main_module.get_db] = lambda: db
        body = TestClient(prod_app).get("/api/health").json()
    finally:
        monkeypatch.undo()
        importlib.reload(main_module)
    assert CONTRACT_KEYS <= body.keys()
    assert "disk" not in body


def test_openapi_schema_is_served(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "/api/documents" in resp.json()["paths"]
