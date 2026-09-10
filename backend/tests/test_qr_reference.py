"""Swiss QR-bill references (R-51).

Two reference schemes exist on a Swiss QR bill:

* **SCOR** — ISO 11649 creditor reference (`RF` + 2 check digits + up to 21
  alphanumerics). Used with a regular IBAN. This is what the PDF emits today.
* **QRR** — 27-digit reference with a recursive MOD10 check digit. Only valid
  together with a QR-IBAN (IID 30000–31999).

Vectors come from the ISO 11649 example (`539007547034` → `RF18…`) and the
SIX "Swiss Payment Standards" implementation guidelines.
"""
from decimal import Decimal
from unittest.mock import patch

import pytest

from app.services.qr_reference import (
    format_creditor_reference,
    generate_creditor_reference,
    generate_qr_reference,
    is_qr_iban,
    mod10_recursive,
    validate_creditor_reference,
    validate_qr_iban,
)


def _iso7064_remainder(ref: str) -> int:
    """Independent ISO 7064 MOD 97-10 check: move RFxx to the end, letters → 10..35."""
    moved = ref[4:] + ref[:4]
    digits = "".join(str(int(c, 36)) for c in moved)
    return int(digits) % 97


# ── ISO 11649 (SCOR) ─────────────────────────────────────────

def test_iso11649_known_vector():
    assert generate_creditor_reference("539007547034") == "RF18539007547034"


@pytest.mark.parametrize("number", ["1", "42", "RE-2026-0042", "abc123", "0000001"])
def test_iso11649_check_digits_satisfy_mod97(number):
    ref = generate_creditor_reference(number)
    assert ref.startswith("RF")
    assert _iso7064_remainder(ref) == 1
    assert validate_creditor_reference(ref)


def test_iso11649_sanitizes_non_alphanumerics_and_uppercases():
    # Dashes, spaces, dots and umlauts are not allowed in the reference body.
    assert generate_creditor_reference("re-2026 .0042/ä") == generate_creditor_reference("RE20260042")
    assert generate_creditor_reference("RE-2026-0042")[4:] == "RE20260042"


def test_iso11649_empty_input_falls_back_to_zero():
    ref = generate_creditor_reference("---")
    assert ref[4:] == "0"
    assert validate_creditor_reference(ref)


def test_iso11649_reference_never_exceeds_25_characters():
    """ISO 11649: 25 characters max, i.e. at most 21 after `RFxx`.

    A document number longer than that must not produce an invalid reference
    that banks reject at payment time.
    """
    ref = generate_creditor_reference("1234567890123456789012345")  # 25 digits
    assert len(ref) <= 25
    assert validate_creditor_reference(ref)
    # The distinguishing tail of a counter-based number survives.
    assert ref.endswith("2345")


def test_validate_creditor_reference_rejects_bad_check_digits():
    assert not validate_creditor_reference("RF19539007547034")
    assert not validate_creditor_reference("RF18 5390 0754 7034".replace(" ", "") + "X" * 10)
    assert not validate_creditor_reference("XX18539007547034")
    assert validate_creditor_reference("RF18 5390 0754 7034")  # spaces tolerated


def test_format_creditor_reference_groups_of_four():
    assert format_creditor_reference("RF18539007547034") == "RF18 5390 0754 7034"
    assert format_creditor_reference("RF040") == "RF04 0"


# ── MOD10 recursive (QRR) ────────────────────────────────────

def test_mod10_recursive_known_vector():
    # SIX implementation guideline example: 26 digits → check digit 7.
    assert mod10_recursive("21000000000313947143000901") == 7
    assert generate_qr_reference("21000000000313947143000901") == "210000000003139471430009017"


@pytest.mark.parametrize(
    ("digits", "check"),
    [
        ("0", 0),
        ("1", 1),  # table[(0+1)%10] = 9 → (10-9)%10 = 1
        ("00000000000000000000000000", 0),
        ("11111111111111111111111111", 0),
    ],
)
def test_mod10_recursive_edge_vectors(digits, check):
    assert mod10_recursive(digits) == check


def test_mod10_recursive_rejects_non_digits():
    with pytest.raises(ValueError):
        mod10_recursive("12a4")


def test_qr_reference_is_27_digits_zero_padded():
    ref = generate_qr_reference("RE-2026-0042")
    assert len(ref) == 27
    assert ref.isdigit()
    assert ref[:-1].endswith("20260042")
    assert mod10_recursive(ref[:-1]) == int(ref[-1])


def test_qr_reference_strips_non_digits_and_limits_length():
    assert generate_qr_reference("ab-12") == generate_qr_reference("12")
    with pytest.raises(ValueError):
        generate_qr_reference("1" * 27)  # 27 payload digits leave no room for the check digit
    with pytest.raises(ValueError):
        generate_qr_reference("no digits at all")


# ── IBAN helpers ─────────────────────────────────────────────

@pytest.mark.parametrize("iban", ["CH93 0076 2011 6238 5295 7", "LI21 0881 0000 2324 0130 0"])
def test_validate_qr_iban_accepts_ch_and_li(iban):
    assert validate_qr_iban(iban)


@pytest.mark.parametrize("iban", ["DE89370400440532013000", "CH93007620116238529", "", "CH9300762011623852957X"])
def test_validate_qr_iban_rejects_others(iban):
    assert not validate_qr_iban(iban)


def test_is_qr_iban_uses_the_qr_iid_range():
    # IID (positions 5–9) between 30000 and 31999 marks a QR-IBAN.
    assert is_qr_iban("CH44 3199 9123 0008 8901 2")
    assert is_qr_iban("CH4430000123000889012")
    assert not is_qr_iban("CH93 0076 2011 6238 5295 7")
    assert not is_qr_iban("CH4432000123000889012")


# ── EUR variant on the QR slip ───────────────────────────────

def _make_doc(currency: str):
    from types import SimpleNamespace

    client = SimpleNamespace(
        company_name="Debtor AG", street="Rue 1", postal_code="1200", city="Genève", country="CH",
        contact_person=None, customer_number="K-1", email=None,
    )
    return SimpleNamespace(
        document_type="rechnung", document_number="RE-7", date=None, due_date=None,
        client=client, total=Decimal("1234.50"), currency=currency,
    )


def _make_settings():
    from types import SimpleNamespace

    return SimpleNamespace(
        company_name="Creditor GmbH", street="Bahnhofstrasse 1", postal_code="8001", city="Zürich",
        iban="CH93 0076 2011 6238 5295 7", uid="CHE-123.456.789", phone="", email="",
        pdf_template="modern",
    )


@pytest.mark.parametrize("currency", ["CHF", "EUR"])
def test_qr_payload_carries_document_currency(currency):
    import qrcode

    from app.services.pdf_generator import _add_qr_bill_page, _build_styles

    captured = []
    original_add_data = qrcode.QRCode.add_data

    def _spy(self, data, *a, **kw):
        captured.append(data)
        return original_add_data(self, data, *a, **kw)

    with patch.object(qrcode.QRCode, "add_data", _spy):
        _add_qr_bill_page([], _make_doc(currency), _make_settings(), _build_styles())

    assert len(captured) == 1
    lines = captured[0].split("\r\n")
    assert lines[:3] == ["SPC", "0200", "1"]
    assert lines[3] == "CH9300762011623852957"
    assert lines[18] == "1234.50"
    assert lines[19] == currency
    assert lines[27] == "SCOR"
    assert validate_creditor_reference(lines[28])
    assert lines[-1] == "EPD"
