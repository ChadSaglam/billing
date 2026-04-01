import datetime as dt
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload

from app.models.document import Document
from app.models.line_item import LineItem
from app.services.number_generator import generate_document_number


DELTAS = {
    "monthly": relativedelta(months=1),
    "quarterly": relativedelta(months=3),
    "yearly": relativedelta(years=1),
}


def process_recurring_invoices(db: Session) -> int:
    today = dt.date.today()
    docs = (
        db.query(Document)
        .options(joinedload(Document.line_items))
        .filter(
            Document.recurrence.isnot(None),
            Document.next_recurrence_date <= today,
            Document.document_type == "rechnung",
            Document.status.in_(["paid", "sent", "overdue"]),
        )
        .all()
    )

    created = 0
    for doc in docs:
        delta = DELTAS.get(doc.recurrence)
        if not delta:
            continue

        new_date = doc.next_recurrence_date
        new_due = new_date + dt.timedelta(days=doc.payment_terms_days)
        doc_number = generate_document_number(db, "rechnung")

        new_doc = Document(
            document_type="rechnung",
            document_number=doc_number,
            client_id=doc.client_id,
            tenant_id=doc.tenant_id,
            date=new_date,
            due_date=new_due,
            payment_terms_days=doc.payment_terms_days,
            status="draft",
            subtotal=doc.subtotal,
            discount_percent=doc.discount_percent,
            discount_amount=doc.discount_amount,
            vat_amount=doc.vat_amount,
            total=doc.total,
            currency=doc.currency,
            notes=doc.notes,
            recurrence=doc.recurrence,
            next_recurrence_date=new_date + delta,
        )
        db.add(new_doc)
        db.flush()

        for item in doc.line_items:
            db.add(LineItem(
                document_id=new_doc.id,
                position=item.position,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.total_price,
                unit=item.unit,
                vat_rate=item.vat_rate,
            ))

        doc.next_recurrence_date = new_date + delta
        created += 1

    db.commit()
    return created
