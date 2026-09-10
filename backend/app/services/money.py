"""Money rounding helpers for Swiss invoices."""

from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
FIVE_RAPPEN = Decimal("0.05")


def round_to_5_rappen(amount: Decimal) -> Decimal:
    """Round to the nearest 5 Rappen, halves away from zero (kaufmännisch).

    Since 2007 the smallest CHF coin is 5 Rappen, so a cash-payable total
    ends in 0 or 5. Electronic payments (QR bill, TWINT, card) keep the cent.
    """
    steps = (Decimal(amount) / FIVE_RAPPEN).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return (steps * FIVE_RAPPEN).quantize(CENT)
