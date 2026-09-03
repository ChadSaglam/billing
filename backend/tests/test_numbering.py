"""Per-tenant document numbering (R-04, R-37)."""
import uuid


def _client_payload():
    return {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "Numbering AG",
        "street": "Teststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
    }


def _doc_payload(client_id):
    return {
        "document_type": "rechnung",
        "client_id": client_id,
        "date": "2026-01-15",
        "line_items": [
            {
                "position": 1,
                "description": "Beratung",
                "quantity": "1",
                "unit_price": "100.00",
                "total_price": "100.00",
            }
        ],
    }


def _make_invoice(client, headers):
    client_id = client.post("/api/clients", json=_client_payload(), headers=headers).json()["id"]
    resp = client.post("/api/documents", json=_doc_payload(client_id), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_each_tenant_starts_its_own_sequence(client, make_tenant):
    """Two fresh tenants both get their first invoice number.

    Before R-37 the generator read the first CompanySettings row it found,
    so tenant B consumed tenant A's counter.
    """
    a, b = make_tenant("-a"), make_tenant("-b")
    doc_a = _make_invoice(client, a["headers"])
    doc_b = _make_invoice(client, b["headers"])
    assert doc_a["document_number"] == doc_b["document_number"]


def test_numbers_increment_within_a_tenant(client, make_tenant):
    a = make_tenant()
    first = _make_invoice(client, a["headers"])["document_number"]
    second = _make_invoice(client, a["headers"])["document_number"]
    assert int(second) == int(first) + 1


def test_same_customer_number_allowed_in_different_tenants(client, make_tenant):
    a, b = make_tenant("-a"), make_tenant("-b")
    payload = _client_payload()
    assert client.post("/api/clients", json=payload, headers=a["headers"]).status_code == 201
    assert client.post("/api/clients", json=payload, headers=b["headers"]).status_code == 201
