"""Payment references for Swiss QR bills.

* ISO 11649 Creditor Reference (SCOR, `RF…`) — used with a regular IBAN.
  This is what the PDF emits today.
* QR reference (QRR, 27 digits, recursive MOD10 check digit) — only valid
  together with a QR-IBAN (IID 30000–31999). Provided for tenants that get a
  QR-IBAN; not wired into the PDF yet.
"""

import re

# ISO 11649: 25 characters in total, 4 of which are "RF" + check digits.
CREDITOR_REFERENCE_MAX_BODY = 21

# SIX Swiss Payment Standards: the QR reference is 27 digits, the last one a check digit.
QR_REFERENCE_LENGTH = 27

_MOD10_TABLE = (0, 9, 4, 6, 8, 2, 7, 1, 3, 5)


def _iso7064_numeric(chars: str) -> str:
    return "".join(ch if ch.isdigit() else str(ord(ch) - 55) for ch in chars)


def generate_creditor_reference(document_number: str) -> str:
    """Create RF## creditor reference per ISO 11649."""
    raw = re.sub(r"[^A-Z0-9]", "", document_number.upper())
    if not raw:
        raw = "0"
    # ISO 11649 allows 21 characters after "RFxx". Keep the tail: for
    # counter-based numbers that is the part that changes.
    raw = raw[-CREDITOR_REFERENCE_MAX_BODY:]

    check = 98 - (int(_iso7064_numeric(raw + "RF00")) % 97)
    return f"RF{check:02d}{raw}"


def validate_creditor_reference(ref: str) -> bool:
    """True when `ref` is a well-formed ISO 11649 reference with a valid check."""
    clean = ref.replace(" ", "").upper()
    if not re.fullmatch(r"RF\d{2}[A-Z0-9]{1,21}", clean):
        return False
    return int(_iso7064_numeric(clean[4:] + clean[:4])) % 97 == 1


def format_creditor_reference(ref: str) -> str:
    """Format with spaces every 4 chars for display."""
    return " ".join(ref[i:i + 4] for i in range(0, len(ref), 4))


def mod10_recursive(digits: str) -> int:
    """Recursive MOD10 check digit (SIX / PostFinance ESR + QRR scheme)."""
    if not digits.isdigit():
        raise ValueError("MOD10 input must contain digits only")
    carry = 0
    for ch in digits:
        carry = _MOD10_TABLE[(carry + int(ch)) % 10]
    return (10 - carry) % 10


def generate_qr_reference(document_number: str) -> str:
    """27-digit QR reference (QRR): zero-padded digits of the number + MOD10 check digit."""
    body = re.sub(r"\D", "", document_number)
    if not body:
        raise ValueError("QR reference needs at least one digit")
    if len(body) > QR_REFERENCE_LENGTH - 1:
        raise ValueError(f"QR reference body longer than {QR_REFERENCE_LENGTH - 1} digits")
    body = body.zfill(QR_REFERENCE_LENGTH - 1)
    return f"{body}{mod10_recursive(body)}"


def validate_qr_iban(iban: str) -> bool:
    """Check IBAN is CH or LI (required for Swiss QR bill)."""
    clean = iban.replace(" ", "").upper()
    return bool(re.match(r"^(CH|LI)\d{2}\d{17}$", clean))


def is_qr_iban(iban: str) -> bool:
    """A QR-IBAN carries a QR-IID (30000–31999) in positions 5–9. QRR references require one."""
    clean = iban.replace(" ", "").upper()
    if not validate_qr_iban(clean):
        return False
    return 30000 <= int(clean[4:9]) <= 31999
