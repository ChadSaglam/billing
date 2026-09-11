"""Per-tenant rate-limit keys (R-92b).

Authenticated expensive routes are throttled per tenant (`tid` from the
Bearer token); anonymous routes keep the per-IP bucket.
"""

from fastapi.testclient import TestClient
from starlette.requests import Request

from app.auth import create_access_token, create_refresh_token
from app.limiter import TENANT_LIMIT, ip_key, tenant_or_ip_key

LIMIT = int(TENANT_LIMIT.split("/")[0])


def _request(authorization: str | None = None, ip: str = "203.0.113.7") -> Request:
    headers = [(b"authorization", authorization.encode())] if authorization else []
    return Request({"type": "http", "method": "GET", "path": "/", "headers": headers, "client": (ip, 1234)})


def test_key_uses_tid_from_valid_access_token():
    token = create_access_token(user_id=1, tenant_id=42, role="admin")
    assert tenant_or_ip_key(_request(f"Bearer {token}")) == "tenant:42"


def test_key_falls_back_to_ip_without_or_with_invalid_token():
    assert tenant_or_ip_key(_request()) == "ip:203.0.113.7"
    assert tenant_or_ip_key(_request("Bearer not-a-jwt")) == "ip:203.0.113.7"
    assert tenant_or_ip_key(_request("Basic abc")) == "ip:203.0.113.7"
    assert ip_key(_request()) == "ip:203.0.113.7"


def test_key_ignores_refresh_tokens(db):
    """Only access tokens carry a trustworthy tenant for request routing."""
    token = create_refresh_token(1, 42, db)
    assert tenant_or_ip_key(_request(f"Bearer {token}")) == "ip:203.0.113.7"


def test_two_tenants_from_one_ip_do_not_share_a_bucket(client, make_tenant, rate_limiter_enabled):
    a, b = make_tenant("-a"), make_tenant("-b")
    body = {"document_ids": [], "status": "sent"}
    for _ in range(LIMIT):
        resp = client.post("/api/documents/bulk/status", json=body, headers=a["headers"])
        assert resp.status_code != 429, resp.text
    assert client.post("/api/documents/bulk/status", json=body, headers=a["headers"]).status_code == 429
    # Same client IP, other tenant: untouched bucket.
    assert client.post("/api/documents/bulk/status", json=body, headers=b["headers"]).status_code != 429


def test_same_tenant_from_two_ips_shares_a_bucket(client, make_tenant, rate_limiter_enabled):
    t = make_tenant()
    body = {"document_ids": [], "status": "sent"}
    for _ in range(LIMIT):
        resp = client.post("/api/documents/bulk/status", json=body, headers=t["headers"])
        assert resp.status_code != 429, resp.text
    # The `client` fixture keeps the get_db override active; only the source
    # address differs here.
    with TestClient(client.app, client=("198.51.100.9", 4321)) as other_ip:
        assert other_ip.post("/api/documents/bulk/status", json=body, headers=t["headers"]).status_code == 429
