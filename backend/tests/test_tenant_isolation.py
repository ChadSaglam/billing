"""Multi-tenant isolation — the security property this SaaS lives or dies on."""
import uuid

import pytest


def _client_payload():
    return {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "Isolation Test AG",
        "street": "Teststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
    }


@pytest.fixture
def two_tenants(make_tenant):
    return make_tenant("-a"), make_tenant("-b")


def test_client_list_is_scoped_to_tenant(client, two_tenants):
    a, b = two_tenants
    created = client.post("/api/clients", json=_client_payload(), headers=a["headers"])
    assert created.status_code == 201, created.text
    client_id = created.json()["id"]

    ids_b = [c["id"] for c in client.get("/api/clients", headers=b["headers"]).json()]
    assert client_id not in ids_b


def test_client_detail_is_not_readable_cross_tenant(client, two_tenants):
    a, b = two_tenants
    client_id = client.post("/api/clients", json=_client_payload(), headers=a["headers"]).json()["id"]
    assert client.get(f"/api/clients/{client_id}", headers=b["headers"]).status_code == 404


def test_client_cannot_be_deleted_cross_tenant(client, two_tenants):
    a, b = two_tenants
    client_id = client.post("/api/clients", json=_client_payload(), headers=a["headers"]).json()["id"]
    assert client.delete(f"/api/clients/{client_id}", headers=b["headers"]).status_code == 404
    assert client.get(f"/api/clients/{client_id}", headers=a["headers"]).status_code == 200


def test_document_is_not_readable_cross_tenant(client, two_tenants):
    a, b = two_tenants
    client_id = client.post("/api/clients", json=_client_payload(), headers=a["headers"]).json()["id"]
    doc = client.post(
        "/api/documents",
        json={
            "document_type": "rechnung",
            "client_id": client_id,
            "date": "2026-01-15",
            "line_items": [
                {"position": 1, "description": "Beratung", "quantity": "2", "unit_price": "250.00"}
            ],
        },
        headers=a["headers"],
    )
    assert doc.status_code == 201, doc.text
    doc_id = doc.json()["id"]

    assert client.get(f"/api/documents/{doc_id}", headers=b["headers"]).status_code == 404
    assert client.get(f"/api/documents/{doc_id}/pdf", headers=b["headers"]).status_code == 404


def test_settings_are_scoped_to_tenant(client, two_tenants):
    a, b = two_tenants
    name_a = client.get("/api/settings", headers=a["headers"]).json()["company_name"]
    name_b = client.get("/api/settings", headers=b["headers"]).json()["company_name"]
    assert name_a != name_b
