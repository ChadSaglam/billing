"""Money is computed by the server, never accepted from the client (R-31)."""
import uuid
from decimal import Decimal


def _client(client, headers):
    payload = {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "Totals AG",
        "street": "Teststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
    }
    return client.post("/api/clients", json=payload, headers=headers).json()["id"]


def _doc(client_id, line_items, **extra):
    return {
        "document_type": "rechnung",
        "client_id": client_id,
        "date": "2026-01-15",
        "line_items": line_items,
        **extra,
    }


def test_line_total_is_quantity_times_unit_price(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    resp = client.post(
        "/api/documents",
        json=_doc(cid, [{"position": 1, "description": "Beratung", "quantity": "2", "unit_price": "250.00"}]),
        headers=t["headers"],
    )
    assert resp.status_code == 201, resp.text
    doc = resp.json()
    assert Decimal(doc["line_items"][0]["total_price"]) == Decimal("500.00")
    assert Decimal(doc["subtotal"]) == Decimal("500.00")


def test_forged_line_total_is_ignored(client, make_tenant):
    """The attack: 2 x CHF 250 booked as CHF 1."""
    t = make_tenant()
    cid = _client(client, t["headers"])
    resp = client.post(
        "/api/documents",
        json=_doc(cid, [{
            "position": 1,
            "description": "Beratung",
            "quantity": "2",
            "unit_price": "250.00",
            "total_price": "1.00",
        }]),
        headers=t["headers"],
    )
    assert resp.status_code == 201, resp.text
    doc = resp.json()
    assert Decimal(doc["line_items"][0]["total_price"]) == Decimal("500.00")
    assert Decimal(doc["total"]) > Decimal("500.00")  # 500 + VAT


def test_forged_document_total_is_ignored_on_update(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc_id = client.post(
        "/api/documents",
        json=_doc(cid, [{"position": 1, "description": "Beratung", "quantity": "1", "unit_price": "100.00"}]),
        headers=t["headers"],
    ).json()["id"]

    resp = client.put(
        f"/api/documents/{doc_id}",
        json={"total": "1.00", "subtotal": "1.00", "vat_amount": "0.00", "notes": "nice try"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    assert doc["notes"] == "nice try"
    assert Decimal(doc["subtotal"]) == Decimal("100.00")


def test_totals_survive_a_line_item_edit(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc_id = client.post(
        "/api/documents",
        json=_doc(cid, [{"position": 1, "description": "Beratung", "quantity": "1", "unit_price": "100.00"}]),
        headers=t["headers"],
    ).json()["id"]

    resp = client.put(
        f"/api/documents/{doc_id}",
        json={"line_items": [
            {"position": 1, "description": "Beratung", "quantity": "3", "unit_price": "100.00"},
            {"position": 2, "description": "Reise", "quantity": "1", "unit_price": "50.00"},
        ]},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["subtotal"]) == Decimal("350.00")
