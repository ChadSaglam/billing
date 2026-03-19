import datetime as dt

from sqlalchemy.orm import Session

from app.models.document import Document


def mark_overdue_invoices(db: Session) -> int:
    """Mark sent invoices past due_date as overdue. Returns count updated."""
    today = dt.date.today()
    overdue_docs = (
        db.query(Document)
        .filter(
            Document.document_type == "rechnung",
            Document.status == "sent",
            Document.due_date < today,
            Document.due_date.isnot(None),
        )
        .all()
    )

    for doc in overdue_docs:
        doc.status = "overdue"

    if overdue_docs:
        db.commit()

    return len(overdue_docs)
