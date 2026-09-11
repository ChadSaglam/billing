"""Document emails go to a BackgroundTask as plain values (R-67) and the
bulk endpoint queues instead of sending SMTP in-request (R-73)."""

import dataclasses
import uuid
from datetime import date
from decimal import Decimal

import pytest

import app.services.email_sender as email_sender
from app.services.email_sender import DocumentEmail

_PLAIN = (str, int, bytes, Decimal, date, type(None))


def _client(client, headers, **overrides):
    payload = {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "Mail AG",
        "street": "Poststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
        "email": "kunde@example.com",
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


@pytest.fixture
def tenant(client, make_tenant):
    t = make_tenant()
    resp = client.put("/api/settings", json={"iban": "CH93 0076 2011 6238 5295 7"}, headers=t["headers"])
    assert resp.status_code == 200, resp.text
    return t


def _assert_plain(email: DocumentEmail):
    assert isinstance(email, DocumentEmail)
    for f in dataclasses.fields(email):
        assert isinstance(getattr(email, f.name), _PLAIN), f.name


def test_single_send_queues_plain_values(client, tenant, monkeypatch):
    sent = []
    monkeypatch.setattr(email_sender, "send_document_email", lambda email: sent.append(email))
    cid = _client(client, tenant["headers"])
    doc = _invoice(client, tenant["headers"], cid)

    resp = client.post(f"/api/documents/{doc['id']}/send-email", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["recipient"] == "kunde@example.com"

    assert len(sent) == 1
    email = sent[0]
    _assert_plain(email)
    assert email.document_number == doc["document_number"]
    assert email.currency == "CHF"
    assert email.total == Decimal("108.10")
    assert email.portal_token
    assert email.pdf_bytes.startswith(b"%PDF")

    again = client.get(f"/api/documents/{doc['id']}", headers=tenant["headers"]).json()
    assert again["status"] == "sent"


def test_single_send_without_client_email_is_400(client, tenant):
    cid = _client(client, tenant["headers"], email=None)
    doc = _invoice(client, tenant["headers"], cid)
    resp = client.post(f"/api/documents/{doc['id']}/send-email", headers=tenant["headers"])
    assert resp.status_code == 400


def test_bulk_send_queues_in_background(client, tenant, monkeypatch):
    batches = []
    monkeypatch.setattr(email_sender, "send_document_emails", lambda emails: batches.append(emails))

    def _no_sync_smtp(*_a, **_k):
        raise AssertionError("SMTP must not be called in-request")

    monkeypatch.setattr(email_sender.smtplib, "SMTP_SSL", _no_sync_smtp)

    cid = _client(client, tenant["headers"])
    no_mail = _client(client, tenant["headers"], email=None)
    a = _invoice(client, tenant["headers"], cid)
    b = _invoice(client, tenant["headers"], cid)
    c = _invoice(client, tenant["headers"], no_mail)

    resp = client.post(
        "/api/documents/bulk/send-email",
        json={"document_ids": [a["id"], b["id"], c["id"]]},
        headers=tenant["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["queued"] == 2
    assert body["errors"] == [f"{c['document_number']}: no email"]

    assert len(batches) == 1
    assert {e.document_number for e in batches[0]} == {a["document_number"], b["document_number"]}
    for email in batches[0]:
        _assert_plain(email)

    for d in (a, b):
        assert client.get(f"/api/documents/{d['id']}", headers=tenant["headers"]).json()["status"] == "sent"


def test_bulk_sender_continues_after_a_failure(monkeypatch):
    calls = []

    def _send(email):
        calls.append(email.document_number)
        if email.document_number == "1":
            raise RuntimeError("boom")

    monkeypatch.setattr(email_sender, "send_document_email", _send)
    mk = lambda n: DocumentEmail(  # noqa: E731
        recipient_email="k@example.com",
        recipient_name="K",
        document_type="rechnung",
        document_number=n,
        date=None,
        due_date=None,
        payment_terms_days=None,
        currency="CHF",
        total=Decimal("1"),
        portal_token=None,
        company_name="C",
        company_phone=None,
        company_email=None,
        pdf_bytes=b"%PDF",
    )
    email_sender.send_document_emails([mk("1"), mk("2")])
    assert calls == ["1", "2"]
