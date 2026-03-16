from sqlalchemy.orm import Session

from app.models.settings import CompanySettings


def generate_document_number(db: Session, document_type: str) -> str:
    settings = db.query(CompanySettings).first()
    if not settings:
        raise RuntimeError("Company settings not initialized")

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
