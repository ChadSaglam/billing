"""Request ids and the uniform error envelope (R-27).

The envelope is additive: `detail` stays exactly what FastAPI produced (the
frontend parses it today), `error` carries code/message/request_id.
"""


def test_request_id_is_echoed_when_provided(client):
    resp = client.get("/api/health", headers={"X-Request-ID": "abc-123"})
    assert resp.headers["X-Request-ID"] == "abc-123"
    assert resp.headers["Server-Timing"].startswith("app;dur=")


def test_request_id_is_generated_when_absent(client):
    resp = client.get("/api/health")
    assert resp.headers["X-Request-ID"]


def test_404_carries_detail_and_error_envelope(client):
    resp = client.get("/api/does-not-exist", headers={"X-Request-ID": "rid-404"})
    assert resp.status_code == 404
    body = resp.json()
    assert body["detail"] == "Not Found"
    assert body["error"]["code"] == "http_404"
    assert body["error"]["message"] == "Not Found"
    assert body["error"]["request_id"] == "rid-404"


def test_401_keeps_www_authenticate_header(client):
    resp = client.get("/api/clients")
    assert resp.status_code == 401
    assert resp.headers.get("WWW-Authenticate") == "Bearer"
    assert resp.json()["error"]["code"] == "http_401"


def test_422_keeps_detail_list_and_adds_error(client):
    resp = client.post("/api/auth/register", json={"email": "not-an-email"})
    assert resp.status_code == 422
    body = resp.json()
    assert isinstance(body["detail"], list) and body["detail"]
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["request_id"] == resp.headers["X-Request-ID"]
    assert any(f["field"] == "password" for f in body["error"]["fields"])
