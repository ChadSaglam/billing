"""Money is computed by the server, never accepted from the client (R-31)."""

import uuid
from decimal import Decimal

import pytest

from app.services.money import round_to_5_rappen


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
        json=_doc(
            cid,
            [
                {
                    "position": 1,
                    "description": "Beratung",
                    "quantity": "2",
                    "unit_price": "250.00",
                    "total_price": "1.00",
                }
            ],
        ),
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
        json={
            "line_items": [
                {"position": 1, "description": "Beratung", "quantity": "3", "unit_price": "100.00"},
                {"position": 2, "description": "Reise", "quantity": "1", "unit_price": "50.00"},
            ]
        },
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["subtotal"]) == Decimal("350.00")


# ── R-49 rounding matrix ──────────────────────────────────────
#
# What the server does today (documents.py::_build_line_item / _recalc_totals):
#   * line total  = quantity × unit_price, quantized to 0.01 with Decimal's
#                   default context → ROUND_HALF_EVEN
#   * discount    = subtotal × pct / 100, quantized the same way
#   * VAT         = Σ per line: line × (1 − discount) × rate / 100, each line
#                   quantized to 0.01 *before* the sum (per-line rounding)
#   * total       = subtotal − discount + VAT (no 5-Rappen rounding)
#
# Swiss practice ("kaufmännisches Runden") is ROUND_HALF_UP. Where the two
# disagree the test is marked xfail(strict=True) so the behaviour is
# documented without silently changing money math — see ROADMAP R-98.


def _post(client, headers, cid, line_items, **extra):
    resp = client.post("/api/documents", json=_doc(cid, line_items, **extra), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _li(unit_price, quantity="1", vat_rate="8.1", position=1):
    return {
        "position": position,
        "description": "Pos",
        "quantity": quantity,
        "unit_price": unit_price,
        "vat_rate": vat_rate,
    }


def test_multiple_vat_rates_are_summed_per_rate(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(
        client,
        t["headers"],
        cid,
        [
            _li("100.00", vat_rate="8.1", position=1),
            _li("100.00", vat_rate="2.6", position=2),
            _li("100.00", vat_rate="0", position=3),
        ],
    )
    assert Decimal(doc["subtotal"]) == Decimal("300.00")
    assert Decimal(doc["vat_amount"]) == Decimal("8.10") + Decimal("2.60") + Decimal("0.00")
    assert Decimal(doc["total"]) == Decimal("310.70")


def test_discount_applies_before_vat_on_every_rate(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(
        client,
        t["headers"],
        cid,
        [
            _li("100.00", vat_rate="8.1", position=1),
            _li("100.00", vat_rate="2.6", position=2),
            _li("100.00", vat_rate="0", position=3),
        ],
        discount_percent="10",
    )
    assert Decimal(doc["discount_amount"]) == Decimal("30.00")
    # 90 × 8.1 % = 7.29 · 90 × 2.6 % = 2.34 · 0
    assert Decimal(doc["vat_amount"]) == Decimal("9.63")
    assert Decimal(doc["total"]) == Decimal("279.63")


def test_fractional_discount_rounds_once_then_vat_uses_the_net(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("33.33")], discount_percent="12.5")
    # 33.33 × 12.5 % = 4.16625 → 4.17
    assert Decimal(doc["discount_amount"]) == Decimal("4.17")
    # 29.16 × 8.1 % = 2.36196 → 2.36
    assert Decimal(doc["vat_amount"]) == Decimal("2.36")
    assert Decimal(doc["total"]) == Decimal("31.52")


def test_vat_is_rounded_per_line_not_per_document(client, make_tenant):
    """Documents today: 3 × (0.10 × 8.1 % = 0.0081 → 0.01) = 0.03.

    Document-level rounding would give 0.30 × 8.1 % = 0.0243 → 0.02. Both
    are accepted by the ESTV as long as the invoice is consistent; this test
    pins the choice so a change is deliberate.
    """
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("0.10", position=i) for i in range(1, 4)])
    assert Decimal(doc["subtotal"]) == Decimal("0.30")
    assert Decimal(doc["vat_amount"]) == Decimal("0.03")


def test_zero_rate_document_has_no_vat(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("19.99", quantity="3", vat_rate="0")])
    assert Decimal(doc["subtotal"]) == Decimal("59.97")
    assert Decimal(doc["vat_amount"]) == Decimal("0.00")
    assert Decimal(doc["total"]) == Decimal("59.97")


def test_empty_document_totals_are_zero(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [], discount_percent="10")
    assert Decimal(doc["subtotal"]) == Decimal("0")
    assert Decimal(doc["discount_amount"]) == Decimal("0")
    assert Decimal(doc["vat_amount"]) == Decimal("0")
    assert Decimal(doc["total"]) == Decimal("0")


def test_half_cent_vat_rounds_half_even_today(client, make_tenant):
    """5.00 × 8.1 % = 0.405 exactly. Decimal default → 0.40 (banker's)."""
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("5.00")])
    assert Decimal(doc["vat_amount"]) == Decimal("0.40")
    assert Decimal(doc["total"]) == Decimal("5.40")


@pytest.mark.xfail(
    strict=True,
    reason="R-98: Swiss commercial rounding is ROUND_HALF_UP (0.405 → 0.41); "
    "_recalc_totals uses Decimal's default ROUND_HALF_EVEN",
)
def test_half_cent_vat_rounds_half_up(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("5.00")])
    assert Decimal(doc["vat_amount"]) == Decimal("0.41")


@pytest.mark.xfail(
    strict=True,
    reason="R-98: 1.5 × 2.35 = 3.525 should round half-up to 3.53; "
    "_build_line_item uses Decimal's default ROUND_HALF_EVEN",
)
def test_half_cent_line_total_rounds_half_up(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("2.35", quantity="1.5", vat_rate="0")])
    assert Decimal(doc["line_items"][0]["total_price"]) == Decimal("3.53")


@pytest.mark.xfail(
    strict=True,
    reason="R-99: quantity column is Numeric(10,2) — 1.235 is stored as 1.24 while "
    "total_price was computed from 1.235, so the printed line no longer multiplies out",
)
def test_three_decimal_quantity_stays_consistent_with_line_total(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("10.00", quantity="1.235", vat_rate="0")])
    item = doc["line_items"][0]
    assert Decimal(item["quantity"]) * Decimal(item["unit_price"]) == Decimal(item["total_price"])


def test_two_decimal_quantities_multiply_out_exactly(client, make_tenant):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("120.00", quantity="0.25", vat_rate="0")])
    item = doc["line_items"][0]
    assert Decimal(item["quantity"]) == Decimal("0.25")
    assert Decimal(item["total_price"]) == Decimal("30.00")


# ── 5-Rappen cash rounding (helper only — not applied to document totals) ──


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        ("10.00", "10.00"),
        ("10.02", "10.00"),
        ("10.03", "10.05"),
        ("10.025", "10.05"),  # half → away from zero
        ("10.07", "10.05"),
        ("10.08", "10.10"),
        ("10.975", "11.00"),
        ("0.01", "0.00"),
        ("0.03", "0.05"),
        ("-10.03", "-10.05"),
    ],
)
def test_round_to_5_rappen(amount, expected):
    result = round_to_5_rappen(Decimal(amount))
    assert result == Decimal(expected)
    assert result.as_tuple().exponent == -2


def test_document_total_is_not_cash_rounded(client, make_tenant):
    """QR-bill amounts are paid electronically and keep the cent (5.40 stays 5.40,
    5.42 stays 5.42). Cash rounding is a display concern for cash receipts only."""
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _post(client, t["headers"], cid, [_li("5.02", vat_rate="8.1")])
    assert Decimal(doc["total"]) == Decimal("5.43")
    assert round_to_5_rappen(Decimal(doc["total"])) == Decimal("5.45")
