"""The most important tests in this repo.

Tenant scoping is enforced by hand — every query has to filter on tenant_id.
One forgotten filter leaks another company's invoices. These tests create two
workspaces and assert that neither can see or touch the other's data.

When you add an endpoint, add it here.
"""

import pytest

pytestmark = pytest.mark.db


@pytest.fixture
def two_workspaces(make_workspace):
    a = make_workspace("Alpha AG")
    b = make_workspace("Beta GmbH")
    return a, b


def _create_client(client, ws, number: str, name: str) -> int:
    resp = client.post(
        "/api/clients",
        headers=ws["headers"],
        json={
            "customer_number": number,
            "company_name": name,
            "street": "Teststrasse 1",
            "postal_code": "8000",
            "city": "Zürich",
            "country": "Schweiz",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_document(client, ws, client_id: int) -> int:
    resp = client.post(
        "/api/documents",
        headers=ws["headers"],
        json={
            "document_type": "rechnung",
            "client_id": client_id,
            "date": "2026-01-15",
            "currency": "CHF",
            "payment_terms_days": 30,
            "discount_percent": "0",
            "line_items": [
                {
                    "position": 1,
                    "description": "Beratung",
                    "quantity": "2",
                    "unit_price": "250.00",
                    "total_price": "500.00",
                    "unit": "Stunde",
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ── Clients ──────────────────────────────────────────────────

def test_client_list_shows_only_own_tenant(client, two_workspaces):
    a, b = two_workspaces
    _create_client(client, a, "A-1", "Alpha Customer")
    _create_client(client, b, "B-1", "Beta Customer")

    names_a = {c["company_name"] for c in client.get("/api/clients", headers=a["headers"]).json()}
    names_b = {c["company_name"] for c in client.get("/api/clients", headers=b["headers"]).json()}

    assert names_a == {"Alpha Customer"}
    assert names_b == {"Beta Customer"}


def test_cannot_read_other_tenant_client(client, two_workspaces):
    a, b = two_workspaces
    client_id = _create_client(client, a, "A-2", "Alpha Customer")
    assert client.get(f"/api/clients/{client_id}", headers=b["headers"]).status_code == 404


def test_cannot_update_other_tenant_client(client, two_workspaces):
    a, b = two_workspaces
    client_id = _create_client(client, a, "A-3", "Alpha Customer")
    resp = client.put(
        f"/api/clients/{client_id}",
        headers=b["headers"],
        json={"company_name": "Hijacked"},
    )
    assert resp.status_code == 404


def test_cannot_delete_other_tenant_client(client, two_workspaces):
    a, b = two_workspaces
    client_id = _create_client(client, a, "A-4", "Alpha Customer")
    assert client.delete(f"/api/clients/{client_id}", headers=b["headers"]).status_code == 404
    assert client.get(f"/api/clients/{client_id}", headers=a["headers"]).status_code == 200


# ── Documents ────────────────────────────────────────────────

def test_document_list_shows_only_own_tenant(client, two_workspaces):
    a, b = two_workspaces
    _create_document(client, a, _create_client(client, a, "A-5", "Alpha Customer"))

    assert len(client.get("/api/documents", headers=a["headers"]).json()) == 1
    assert client.get("/api/documents", headers=b["headers"]).json() == []


@pytest.mark.parametrize(
    "method,path_suffix",
    [
        ("get", ""),
        ("get", "/pdf"),
        ("delete", ""),
    ],
)
def test_cannot_touch_other_tenant_document(client, two_workspaces, method, path_suffix):
    a, b = two_workspaces
    doc_id = _create_document(client, a, _create_client(client, a, "A-6", "Alpha Customer"))
    resp = getattr(client, method)(f"/api/documents/{doc_id}{path_suffix}", headers=b["headers"])
    assert resp.status_code == 404, f"{method.upper()} {path_suffix} leaked: {resp.status_code}"


def test_cannot_change_other_tenant_document_status(client, two_workspaces):
    a, b = two_workspaces
    doc_id = _create_document(client, a, _create_client(client, a, "A-7", "Alpha Customer"))
    resp = client.patch(
        f"/api/documents/{doc_id}/status", headers=b["headers"], json={"status": "paid"}
    )
    assert resp.status_code == 404


def test_cannot_duplicate_other_tenant_document(client, two_workspaces):
    a, b = two_workspaces
    doc_id = _create_document(client, a, _create_client(client, a, "A-8", "Alpha Customer"))
    assert client.post(f"/api/documents/{doc_id}/duplicate", headers=b["headers"]).status_code == 404


# ── Settings, services, dashboard ────────────────────────────

def test_settings_are_per_tenant(client, two_workspaces):
    a, b = two_workspaces
    client.put("/api/settings", headers=a["headers"], json={"company_name": "Alpha AG", "iban": "CH11"})
    assert client.get("/api/settings", headers=b["headers"]).json()["company_name"] != "Alpha AG"


def test_dashboard_totals_do_not_mix_tenants(client, two_workspaces):
    a, b = two_workspaces
    _create_document(client, a, _create_client(client, a, "A-9", "Alpha Customer"))
    dash_b = client.get("/api/dashboard", headers=b["headers"])
    assert dash_b.status_code == 200
    body = dash_b.json()
    numeric = [v for v in body.values() if isinstance(v, int | float)]
    assert all(v == 0 for v in numeric), body


# ── Auth ─────────────────────────────────────────────────────

def test_endpoints_reject_missing_token(client):
    for path in ("/api/clients", "/api/documents", "/api/settings", "/api/tenant"):
        assert client.get(path).status_code == 401, path


def test_endpoints_reject_garbage_token(client):
    headers = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/api/clients", headers=headers).status_code == 401


def test_refresh_token_is_not_accepted_as_access_token(client, make_workspace):
    ws = make_workspace()
    login = client.post(
        "/api/auth/login", json={"email": ws["email"], "password": ws["password"]}
    ).json()
    headers = {"Authorization": f"Bearer {login['refresh_token']}"}
    assert client.get("/api/clients", headers=headers).status_code == 401
