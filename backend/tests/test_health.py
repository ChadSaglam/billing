def test_health_reports_database(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "degraded")
    assert "database" in body


def test_openapi_schema_is_served(client):
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "/api/documents" in resp.json()["paths"]
