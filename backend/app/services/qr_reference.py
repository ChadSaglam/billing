"""Generate ISO 11649 Creditor Reference (SCOR) from document number."""


def generate_creditor_reference(document_number: str) -> str:
    """Create RF## creditor reference from document number.
    
    Uses ISO 11649 / SCOR format accepted by Swiss QR bills.
    """
    # Pad document number to ensure minimum length
    raw = document_number.replace(" ", "").upper()

    # Calculate check digits: append RF00, convert letters to numbers, mod 97
    ref_for_calc = raw + "RF00"
    numeric_str = ""
    for ch in ref_for_calc:
        if ch.isdigit():
            numeric_str += ch
        else:
            numeric_str += str(ord(ch) - 55)  # A=10, B=11, ...

    check = 98 - (int(numeric_str) % 97)
    return f"RF{check:02d}{raw}"


def format_creditor_reference(ref: str) -> str:
    """Format reference with spaces every 4 chars for display."""
    return " ".join(ref[i:i+4] for i in range(0, len(ref), 4))
