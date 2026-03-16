from datetime import timedelta
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.document import Document
from app.models.line_item import LineItem
from app.models.settings import CompanySettings
from app.schemas.document import (
    DocumentCreate,
    DocumentListRead,
    DocumentRead,
    DocumentUpdate,
    StatusUpdate,
)
from app.services.number_generator import generate_document_number
from app.services.pdf_generator import generate_invoice_pdf

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _recalc_totals(line_items: list, discount_percent: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum(item.total_price for item in line_items)
    discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.01"))
    total = subtotal - discount_amount
    return subtotal, discount_amount, total


@router.get("", response_model=list[DocumentListRead])
def list_documents(
    document_type: str | None = Query(None),
    status: str | None = Query(None),
    client_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Document).options(joinedload(Document.client))
    if document_type:
        query = query.filter(Document.document_type == document_type)
    if status:
        query = query.filter(Document.status == status)
    if client_id:
        query = query.filter(Document.client_id == client_id)
    return query.order_by(Document.date.desc(), Document.id.desc()).all()


@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("", response_model=DocumentRead, status_code=201)
def create_document(data: DocumentCreate, db: Session = Depends(get_db)):
    doc_data = data.model_dump(exclude={"line_items", "document_number"})

    # Auto-generate document number if not provided
    doc_number = data.document_number
    if not doc_number:
        doc_number = generate_document_number(db, data.document_type)

    doc = Document(**doc_data, document_number=doc_number)

    # Calculate due_date from payment_terms_days
    if doc.due_date is None and doc.payment_terms_days:
        doc.due_date = doc.date + timedelta(days=doc.payment_terms_days)

    db.add(doc)
    db.flush()

    for item_data in data.line_items:
        item = LineItem(**item_data.model_dump(), document_id=doc.id)
        db.add(item)

    db.flush()

    # Recalculate totals from the actual persisted line items
    items = db.query(LineItem).filter(LineItem.document_id == doc.id).all()
    subtotal, discount_amount, total = _recalc_totals(items, data.discount_percent)
    doc.subtotal = subtotal
    doc.discount_amount = discount_amount
    doc.total = total

    db.commit()
    db.refresh(doc)

    return (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc.id)
        .first()
    )


@router.put("/{doc_id}", response_model=DocumentRead)
def update_document(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = data.model_dump(exclude_unset=True, exclude={"line_items"})
    for key, value in update_data.items():
        setattr(doc, key, value)

    # Replace line items if provided
    if data.line_items is not None:
        db.query(LineItem).filter(LineItem.document_id == doc_id).delete()
        for item_data in data.line_items:
            item = LineItem(**item_data.model_dump(), document_id=doc_id)
            db.add(item)
        db.flush()

        # Recalculate
        items = db.query(LineItem).filter(LineItem.document_id == doc_id).all()
        subtotal, discount_amount, total = _recalc_totals(items, doc.discount_percent)
        doc.subtotal = subtotal
        doc.discount_amount = discount_amount
        doc.total = total

    # Recalculate due_date if date or payment_terms changed
    if "date" in update_data or "payment_terms_days" in update_data:
        doc.due_date = doc.date + timedelta(days=doc.payment_terms_days)

    db.commit()

    return (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc.id)
        .first()
    )


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()


@router.post("/{doc_id}/convert", response_model=DocumentRead)
def convert_offerte_to_rechnung(doc_id: int, db: Session = Depends(get_db)):
    offerte = (
        db.query(Document)
        .options(joinedload(Document.line_items))
        .filter(Document.id == doc_id)
        .first()
    )
    if not offerte:
        raise HTTPException(status_code=404, detail="Document not found")
    if offerte.document_type != "offerte":
        raise HTTPException(status_code=400, detail="Only Offerte documents can be converted")

    doc_number = generate_document_number(db, "rechnung")

    rechnung = Document(
        document_type="rechnung",
        document_number=doc_number,
        client_id=offerte.client_id,
        date=offerte.date,
        due_date=offerte.due_date,
        payment_terms_days=offerte.payment_terms_days,
        status="draft",
        subtotal=offerte.subtotal,
        discount_percent=offerte.discount_percent,
        discount_amount=offerte.discount_amount,
        total=offerte.total,
        currency=offerte.currency,
        notes=offerte.notes,
        converted_from_id=offerte.id,
    )
    db.add(rechnung)
    db.flush()

    for item in offerte.line_items:
        new_item = LineItem(
            document_id=rechnung.id,
            position=item.position,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
            unit=item.unit,
        )
        db.add(new_item)

    db.commit()

    return (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == rechnung.id)
        .first()
    )


@router.patch("/{doc_id}/status", response_model=DocumentRead)
def update_document_status(doc_id: int, data: StatusUpdate, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    valid_statuses = {
        "offerte": {"draft", "sent", "accepted", "rejected", "cancelled"},
        "rechnung": {"draft", "sent", "paid", "overdue", "cancelled"},
    }
    if data.status not in valid_statuses.get(doc.document_type, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{data.status}' for {doc.document_type}",
        )

    doc.status = data.status
    db.commit()
    db.refresh(doc)

    return (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc.id)
        .first()
    )


@router.get("/{doc_id}/pdf")
def download_pdf(doc_id: int, db: Session = Depends(get_db)):
    doc = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    settings = db.query(CompanySettings).first()
    if not settings:
        raise HTTPException(status_code=500, detail="Company settings not configured")

    pdf_buffer = generate_invoice_pdf(doc, settings)
    pdf_buffer.seek(0)

    type_label = "Rechnung" if doc.document_type == "rechnung" else "Offerte"
    filename = f"{type_label}_{doc.document_number}.pdf"

    return StreamingResponse(
        BytesIO(pdf_buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
