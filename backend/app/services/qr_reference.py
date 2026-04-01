"""ISO 11649 Creditor Reference (SCOR) for Swiss QR bills."""

import re


def generate_creditor_reference(document_number: str) -> str:
    """Create RF## creditor reference per ISO 11649."""
    raw = re.sub(r"[^A-Z0-9]", "", document_number.upper())
    if not raw:
        raw = "0"

    ref_for_calc = raw + "RF00"
    numeric_str = ""
    for ch in ref_for_calc:
        if ch.isdigit():
            numeric_str += ch
        else:
            numeric_str += str(ord(ch) - 55)

    check = 98 - (int(numeric_str) % 97)
    return f"RF{check:02d}{raw}"


def format_creditor_reference(ref: str) -> str:
    """Format with spaces every 4 chars for display."""
    return " ".join(ref[i:i + 4] for i in range(0, len(ref), 4))


def validate_qr_iban(iban: str) -> bool:
    """Check IBAN is CH or LI (required for Swiss QR bill)."""
    clean = iban.replace(" ", "").upper()
    return bool(re.match(r"^(CH|LI)\d{2}\d{17}$", clean))