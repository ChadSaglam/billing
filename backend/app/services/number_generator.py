from sqlalchemy.orm import Session

from app.models.settings import CompanySettings


def generate_document_number(db: Session, document_type: str, tenant_id: int) -> str:
    """Take the next number from THIS tenant's counter.

    Previously this did `.first()` with no filter, so every tenant consumed
    the first tenant's sequence — cross-tenant number collisions and leaked
    business volume (R-37). The row is locked FOR UPDATE so two concurrent
    requests cannot receive the same number.
    """
    settings = (
        db.query(CompanySettings)
        .filter(CompanySettings.tenant_id == tenant_id)
        .with_for_update()
        .first()
    )
    if not settings:
        raise RuntimeError(f"Company settings not initialized for tenant {tenant_id}")

    if document_type == "rechnung":
        number = settings.next_invoice_number
        settings.next_invoice_number = number + 1
    elif document_type == "offerte":
        number = settings.next_offerte_number
        settings.next_offerte_number = number + 1
    else:
        raise ValueError(f"Unknown document type: {document_type}")

    db.flush()
    return str(number)
