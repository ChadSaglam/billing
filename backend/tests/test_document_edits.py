"""Edit paths that used to corrupt or crash a document (R-66, R-69, R-70, R-72)."""

import io
import uuid
from decimal import Decimal

import pytest
from pypdf import PdfReader


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


# ── R-72 ──────────────────────────────────────────────────────


def _pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def test_pdf_renders_markup_characters_in_names_literally(client, make_tenant):
    """reportlab Paragraph reads its text as XML: an unbalanced `<b>` raises and
    an unknown `<tag>` silently disappears from the printout."""
    t = make_tenant()
    company = "Müller & Söhne <Holding> AG"
    resp = client.put(
        "/api/settings",
        json={"company_name": company, "iban": "CH93 0076 2011 6238 5295 7"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text

    cid = _client(client, t["headers"], company_name="Bold <b> Bauer GmbH", contact_person="R&D <i>Team")
    doc = _invoice(client, t["headers"], cid, notes="Zahlbar <b>sofort")

    resp = client.get(f"/api/documents/{doc['id']}/pdf", headers=t["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("application/pdf")
    text = _pdf_text(resp.content)
    assert "Müller & Söhne <Holding> AG" in text
    assert "Bold <b> Bauer GmbH" in text
    assert "R&D <i>Team" in text
    assert "Zahlbar <b>sofort" in text


def test_classic_template_escapes_names_too(client, make_tenant):
    t = make_tenant()
    resp = client.put(
        "/api/settings",
        json={"company_name": "A <b> B", "pdf_template": "classic", "iban": "CH93 0076 2011 6238 5295 7"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    cid = _client(client, t["headers"], company_name="C <i> D")
    doc = _invoice(client, t["headers"], cid)
    resp = client.get(f"/api/documents/{doc['id']}/pdf", headers=t["headers"])
    assert resp.status_code == 200, resp.text
    text = _pdf_text(resp.content)
    assert "A <b> B" in text
    assert "C <i> D" in text


# ── R-68 ──────────────────────────────────────────────────────


@pytest.mark.parametrize("template", ["modern", "classic"])
def test_pdf_prints_document_currency_not_hardcoded_chf(client, make_tenant, template):
    """A EUR invoice must say EUR on every amount and in the QR payload."""
    t = make_tenant()
    resp = client.put(
        "/api/settings",
        json={"pdf_template": template, "iban": "CH93 0076 2011 6238 5295 7"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    cid = _client(client, t["headers"])
    doc = _invoice(client, t["headers"], cid, currency="EUR", discount_percent="10")
    assert doc["currency"] == "EUR"

    resp = client.get(f"/api/documents/{doc['id']}/pdf", headers=t["headers"])
    assert resp.status_code == 200, resp.text
    text = _pdf_text(resp.content)
    assert "EUR" in text
    assert "CHF" not in text
