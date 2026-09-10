"""Edit paths that used to corrupt or crash a document (R-66, R-69, R-70)."""
import uuid
from decimal import Decimal


def _client(client, headers, **overrides):
    payload = {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "Edit AG",
        "street": "Teststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
        **overrides,
    }
    resp = client.post("/api/clients", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _invoice(client, headers, cid, **extra):
    resp = client.post(
        "/api/documents",
        json={
            "document_type": "rechnung",
            "client_id": cid,
            "date": "2026-01-15",
            "line_items": [
                {"position": 1, "description": "Beratung", "quantity": "1", "unit_price": "100.00", "vat_rate": "8.1"},
            ],
            **extra,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── R-66 ──────────────────────────────────────────────────────

def test_discount_only_update_recalculates_totals(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid)
    assert Decimal(doc["total"]) == Decimal("108.10")

    resp = client.put(f"/api/documents/{doc['id']}", json={"discount_percent": "10"}, headers=t["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(body["discount_amount"]) == Decimal("10.00")
    assert Decimal(body["vat_amount"]) == Decimal("7.29")
    assert Decimal(body["total"]) == Decimal("97.29")

    # And it is persisted, not just echoed.
    again = client.get(f"/api/documents/{doc['id']}", headers=t["headers"]).json()
    assert Decimal(again["total"]) == Decimal("97.29")


# ── R-69 ──────────────────────────────────────────────────────

def test_update_with_null_payment_terms_does_not_crash(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid)

    resp = client.put(
        f"/api/documents/{doc['id']}",
        json={"payment_terms_days": None, "date": "2026-02-01"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["date"] == "2026-02-01"
    # No terms → no computed due date, but no 500 either.
    assert body["due_date"] is None or body["due_date"] >= "2026-02-01"


def test_update_keeps_an_explicit_due_date(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid)

    resp = client.put(
        f"/api/documents/{doc['id']}",
        json={"date": "2026-02-01", "due_date": "2026-02-10"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["due_date"] == "2026-02-10"


def test_update_recomputes_due_date_from_terms_when_not_sent(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid, payment_terms_days=10)

    resp = client.put(f"/api/documents/{doc['id']}", json={"date": "2026-02-01"}, headers=t["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["due_date"] == "2026-02-11"


# ── R-70 ──────────────────────────────────────────────────────

def test_duplicate_with_null_payment_terms_does_not_crash(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid)
    resp = client.put(f"/api/documents/{doc['id']}", json={"payment_terms_days": None}, headers=t["headers"])
    assert resp.status_code == 200, resp.text

    resp = client.post(f"/api/documents/{doc['id']}/duplicate", headers=t["headers"])
    assert resp.status_code == 200, resp.text
    clone = resp.json()
    assert clone["id"] != doc["id"]
    assert clone["status"] == "draft"
    assert Decimal(clone["total"]) == Decimal(doc["total"])
