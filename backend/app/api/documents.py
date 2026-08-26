import csv
import datetime as dt
import io
import zipfile
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.auth import get_tenant_id, require_writable_tenant
from app.database import get_db
from app.models.document import Document
from app.models.line_item import LineItem
from app.models.settings import CompanySettings
from app.plans import enforce_limit
from app.schemas.document import (
    BulkActionRequest,
    BulkStatusRequest,
    DocumentCreate,
    DocumentListRead,
    DocumentRead,
    DocumentUpdate,
    StatusUpdate,
)
from app.services.number_generator import generate_document_number
from app.services.pdf_generator import generate_invoice_pdf
from app.services.sanitizer import sanitize_text

router = APIRouter(prefix="/api/documents", tags=["documents"])

def _recalc_totals(line_items: list, discount_percent: Decimal) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    subtotal = sum(item.total_price for item in line_items)
    discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.01"))
    after_discount = subtotal - discount_amount
    if subtotal > 0:
        discount_ratio = after_discount / subtotal
        vat_amount = sum(
            (item.total_price * discount_ratio * item.vat_rate / Decimal("100")).quantize(Decimal("0.01"))
            for item in line_items
        )
    else:
        vat_amount = Decimal("0")
    total = after_discount + vat_amount
    return subtotal, discount_amount, vat_amount, total

def _get_doc(db: Session, doc_id: int, tenant_id: int, *, with_items: bool = False, with_client: bool = False) -> Document:
    query = db.query(Document).filter(Document.id == doc_id, Document.tenant_id == tenant_id)
    if with_items:
        query = query.options(joinedload(Document.line_items))
    if with_client:
        query = query.options(joinedload(Document.client))
    doc = query.first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

def _load_full(db: Session, doc_id: int, tenant_id: int) -> Document:
    return (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id == doc_id, Document.tenant_id == tenant_id)
        .first()
    )

def _get_settings(db: Session, tenant_id: int) -> CompanySettings:
    settings = db.query(CompanySettings).filter(CompanySettings.tenant_id == tenant_id).first()
    if not settings:
        raise HTTPException(status_code=500, detail="Company settings not configured")
    return settings

# ── CRUD ──────────────────────────────────────────────
@router.get("", response_model=list[DocumentListRead])
def list_documents(
    document_type: str | None = Query(None),
    status: str | None = Query(None),
    client_id: int | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    query = db.query(Document).options(joinedload(Document.client)).filter(Document.tenant_id == tenant_id)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    if status:
        query = query.filter(Document.status == status)
    if client_id:
        query = query.filter(Document.client_id == client_id)
    if search:
        from app.models.client import Client
        pattern = f"%{search}%"
        query = query.filter(
            (Document.document_number.ilike(pattern)) |
            (Document.client.has(Client.company_name.ilike(pattern)))
        )
    return query.order_by(Document.date.desc(), Document.id.desc()).all()

# ── CSV/DATEV Export ──────────────────────────────────
@router.get("/export/csv")
def export_documents_csv(
    document_type: str | None = Query(None),
    status: str | None = Query(None),
    date_from: dt.date | None = Query(None),
    date_to: dt.date | None = Query(None),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    
    query = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.tenant_id == tenant_id)
    )
    if document_type:
        query = query.filter(Document.document_type == document_type)
    if status:
        query = query.filter(Document.status == status)
    if date_from:
        query = query.filter(Document.date >= date_from)
    if date_to:
        query = query.filter(Document.date <= date_to)

    docs = query.order_by(Document.date.asc()).all()

    buffer = BytesIO()
    import codecs
    buffer.write(codecs.BOM_UTF8)
    wrapper = io.TextIOWrapper(buffer, encoding="utf-8", newline="")

    writer = csv.writer(wrapper, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Belegnummer", "Belegdatum", "Fälligkeitsdatum", "Typ",
        "Status", "Kunde_Nr", "Kunde_Name",
        "Pos", "Beschreibung", "Menge", "Einheit", "Einzelpreis",
        "Positionsbetrag_netto", "MWST_Satz_%", "MWST_Betrag",
        "Positionsbetrag_brutto",
        "Rabatt_%", "Rabatt_Betrag",
        "Dokument_Netto", "Dokument_MWST", "Dokument_Total",
        "Währung", "Bezahlt_am", "Zahlungsart", "Zahlungsreferenz",
    ])

    for doc in docs:
        client_nr = doc.client.customer_number if doc.client else ""
        client_name = doc.client.company_name if doc.client else ""
        paid_at_str = doc.paid_at.strftime("%d.%m.%Y") if doc.paid_at else ""

        if not doc.line_items:
            writer.writerow([
                doc.document_number, doc.date.strftime("%d.%m.%Y"),
                doc.due_date.strftime("%d.%m.%Y") if doc.due_date else "",
                doc.document_type, doc.status, client_nr, client_name,
                "", "", "", "", "",
                "", "", "",
                "",
                f"{doc.discount_percent:.2f}", f"{doc.discount_amount:.2f}",
                f"{doc.subtotal:.2f}", f"{doc.vat_amount:.2f}", f"{doc.total:.2f}",
                doc.currency, paid_at_str, doc.payment_method or "", doc.payment_reference or "",
            ])
            continue

        discount_ratio = (
            (Decimal("1") - doc.discount_percent / Decimal("100"))
            if doc.subtotal > 0 else Decimal("1")
        )

        for item in doc.line_items:
            net = item.total_price
            vat_on_item = (net * discount_ratio * item.vat_rate / Decimal("100")).quantize(Decimal("0.01"))
            gross = (net * discount_ratio + vat_on_item).quantize(Decimal("0.01"))

            writer.writerow([
                doc.document_number, doc.date.strftime("%d.%m.%Y"),
                doc.due_date.strftime("%d.%m.%Y") if doc.due_date else "",
                doc.document_type, doc.status, client_nr, client_name,
                item.position, item.description, f"{item.quantity:.2f}", item.unit,
                f"{item.unit_price:.2f}",
                f"{net:.2f}", f"{item.vat_rate:.2f}", f"{vat_on_item:.2f}",
                f"{gross:.2f}",
                f"{doc.discount_percent:.2f}", f"{doc.discount_amount:.2f}",
                f"{doc.subtotal:.2f}", f"{doc.vat_amount:.2f}", f"{doc.total:.2f}",
                doc.currency, paid_at_str, doc.payment_method or "", doc.payment_reference or "",
            ])

    wrapper.detach()
    buffer.seek(0)

    today = dt.date.today().strftime("%Y%m%d")
    return StreamingResponse(
        buffer,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="export_{today}.csv"'},
    )

@router.get("/{doc_id}", response_model=DocumentRead)
def get_document(doc_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _load_full(db, doc_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.post("", response_model=DocumentRead, status_code=201)
def create_document(
    data: DocumentCreate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    tenant=Depends(require_writable_tenant),
):
    month_start = date.today().replace(day=1)
    enforce_limit(
        tenant.plan,
        "max_documents_month",
        db.query(Document)
        .filter(Document.tenant_id == tenant_id, Document.created_at >= month_start)
        .count(),
    )
    doc_data = data.model_dump(exclude={"line_items", "document_number"})
    doc_number = data.document_number
    if not doc_number:
        doc_number = generate_document_number(db, data.document_type)

    doc = Document(**doc_data, document_number=doc_number, tenant_id=tenant_id)

    if doc.due_date is None and doc.payment_terms_days:
        doc.due_date = doc.date + timedelta(days=doc.payment_terms_days)

    # Calculate next_recurrence_date
    if doc.recurrence:
        doc.next_recurrence_date = _calc_next_recurrence(doc.date, doc.recurrence)

    db.add(doc)
    db.flush()

    for item_data in data.line_items:
        item_dict = item_data.model_dump()
        item_dict["description"] = sanitize_text(item_dict.get("description", ""))
        item = LineItem(**item_dict, document_id=doc.id)
        db.add(item)

    db.flush()
    items = db.query(LineItem).filter(LineItem.document_id == doc.id).all()
    subtotal, discount_amount, vat_amount, total = _recalc_totals(items, doc.discount_percent)
    doc.subtotal = subtotal
    doc.discount_amount = discount_amount
    doc.vat_amount = vat_amount
    doc.total = total

    db.commit()
    return _load_full(db, doc.id, tenant_id)

@router.put("/{doc_id}", response_model=DocumentRead)
def update_document(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _get_doc(db, doc_id, tenant_id)
    update_data = data.model_dump(exclude_unset=True, exclude={"line_items"})
    for key, value in update_data.items():
        setattr(doc, key, value)

    if data.line_items is not None:
        db.query(LineItem).filter(LineItem.document_id == doc_id).delete()
        for item_data in data.line_items:
            item_dict = item_data.model_dump()
            item_dict["description"] = sanitize_text(item_dict.get("description", ""))
            item = LineItem(**item_dict, document_id=doc_id)
            db.add(item)
        db.flush()
        items = db.query(LineItem).filter(LineItem.document_id == doc_id).all()
        subtotal, discount_amount, vat_amount, total = _recalc_totals(items, doc.discount_percent)
        doc.subtotal = subtotal
        doc.discount_amount = discount_amount
        doc.vat_amount = vat_amount
        doc.total = total

    if "date" in update_data or "payment_terms_days" in update_data:
        doc.due_date = doc.date + timedelta(days=doc.payment_terms_days)

    if "recurrence" in update_data:
        if doc.recurrence:
            doc.next_recurrence_date = _calc_next_recurrence(doc.date, doc.recurrence)
        else:
            doc.next_recurrence_date = None

    db.commit()
    return _load_full(db, doc.id, tenant_id)

@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _get_doc(db, doc_id, tenant_id)
    db.delete(doc)
    db.commit()

# ── Status + Payment ──────────────────────────────────
@router.patch("/{doc_id}/status", response_model=DocumentRead)
def update_document_status(doc_id: int, data: StatusUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _get_doc(db, doc_id, tenant_id)
    valid_statuses = {
        "offerte": {"draft", "sent", "accepted", "rejected", "cancelled"},
        "rechnung": {"draft", "sent", "paid", "overdue", "cancelled"},
    }
    if data.status not in valid_statuses.get(doc.document_type, set()):
        raise HTTPException(status_code=400, detail=f"Invalid status '{data.status}' for {doc.document_type}")

    doc.status = data.status

    if data.status == "paid":
        from datetime import date as date_type
        doc.paid_at = data.paid_at or date_type.today()
        if data.payment_method:
            doc.payment_method = data.payment_method
        if data.payment_reference:
            doc.payment_reference = data.payment_reference
    elif data.status != "paid":
        doc.paid_at = None
        doc.payment_method = None
        doc.payment_reference = None

    db.commit()
    return _load_full(db, doc.id, tenant_id)

@router.post("/{doc_id}/duplicate", response_model=DocumentRead)
def duplicate_document(
    doc_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    original = (
        db.query(Document)
        .options(joinedload(Document.line_items))
        .filter(Document.id == doc_id, Document.tenant_id == tenant_id)
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Document not found")

    new_number = generate_document_number(db, original.document_type)

    clone = Document(
        tenant_id=tenant_id,
        document_type=original.document_type,
        document_number=new_number,
        client_id=original.client_id,
        date=dt.date.today(),
        due_date=dt.date.today() + dt.timedelta(days=original.payment_terms_days),
        payment_terms_days=original.payment_terms_days,
        status="draft",
        subtotal=original.subtotal,
        discount_percent=original.discount_percent,
        discount_amount=original.discount_amount,
        vat_amount=original.vat_amount,
        total=original.total,
        currency=original.currency,
        notes=original.notes,
        recurrence=None,
    )
    db.add(clone)
    db.flush()

    for item in original.line_items:
        db.add(LineItem(
            document_id=clone.id,
            position=item.position,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            unit_price=item.unit_price,
            total_price=item.total_price,
            vat_rate=item.vat_rate,
        ))

    db.commit()
    db.refresh(clone)
    return clone

# ── Convert Offerte → Rechnung ────────────────────────
@router.post("/{doc_id}/convert", response_model=DocumentRead)
def convert_offerte_to_rechnung(doc_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    offerte = _get_doc(db, doc_id, tenant_id, with_items=True)
    if offerte.document_type != "offerte":
        raise HTTPException(status_code=400, detail="Only Offerte documents can be converted")

    doc_number = generate_document_number(db, "rechnung")
    rechnung = Document(
        document_type="rechnung",
        document_number=doc_number,
        client_id=offerte.client_id,
        tenant_id=tenant_id,
        date=offerte.date,
        due_date=offerte.due_date,
        payment_terms_days=offerte.payment_terms_days,
        status="draft",
        subtotal=offerte.subtotal,
        discount_percent=offerte.discount_percent,
        discount_amount=offerte.discount_amount,
        vat_amount=offerte.vat_amount,
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
            vat_rate=item.vat_rate,
        )
        db.add(new_item)

    offerte.status = "accepted"
    db.commit()
    return _load_full(db, rechnung.id, tenant_id)

# ── Portal Token ──────────────────────────────────────
@router.post("/{doc_id}/portal-token", response_model=DocumentRead)
def generate_portal_token(doc_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _get_doc(db, doc_id, tenant_id)
    doc.generate_portal_token()
    db.commit()
    return _load_full(db, doc.id, tenant_id)

# ── PDF ───────────────────────────────────────────────
@router.get("/{doc_id}/pdf")
def download_pdf(doc_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    doc = _load_full(db, doc_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    settings = _get_settings(db, tenant_id)
    pdf_buffer = generate_invoice_pdf(doc, settings)
    pdf_buffer.seek(0)
    type_label = "Rechnung" if doc.document_type == "rechnung" else "Offerte"
    client_slug = doc.client.company_name.replace(" ", "-").replace("/", "-") if doc.client else "Kunde"
    filename = f"{type_label}_{doc.document_number}_{client_slug}.pdf"
    return StreamingResponse(
        BytesIO(pdf_buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/{doc_id}/preview")
def preview_pdf(doc_id: int, template: str = Query("modern"), token: str = Query(None), db: Session = Depends(get_db)):
    from jose import JWTError
    from jose import jwt as jose_jwt

    from app.config import settings as app_settings

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jose_jwt.decode(token, app_settings.SECRET_KEY, algorithms=[app_settings.ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        tenant_id = payload["tid"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token") from None

    doc = _load_full(db, doc_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    settings = db.query(CompanySettings).filter(CompanySettings.tenant_id == tenant_id).first()
    if not settings:
        raise HTTPException(status_code=500, detail="Company settings not configured")

    original = settings.pdf_template
    settings.pdf_template = template
    pdf_buffer = generate_invoice_pdf(doc, settings)
    settings.pdf_template = original
    pdf_buffer.seek(0)
    return StreamingResponse(
        BytesIO(pdf_buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )

# ── Email ─────────────────────────────────────────────
@router.post("/{doc_id}/send-email")
def send_document_email_endpoint(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    doc = _load_full(db, doc_id, tenant_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.client or not doc.client.email:
        raise HTTPException(status_code=400, detail="Client has no email address")

    company = _get_settings(db, tenant_id)
    pdf_buffer = generate_invoice_pdf(doc, company)
    pdf_buffer.seek(0)
    pdf_bytes = pdf_buffer.read()

    if not doc.portal_token:
        doc.generate_portal_token()

    recipient_email = doc.client.email
    recipient_name = doc.client.company_name

    from app.services.email_sender import send_document_email

    background_tasks.add_task(
        send_document_email,
        recipient_email=recipient_email,
        recipient_name=recipient_name,
        document=doc,
        pdf_bytes=pdf_bytes,
        company=company,
    )

    if doc.status == "draft":
        doc.status = "sent"
    db.commit()

    return {"message": "Email queued successfully", "recipient": recipient_email}
# ── Bulk Actions ──────────────────────────────────────
@router.post("/bulk/status")
def bulk_update_status(data: BulkStatusRequest, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    docs = db.query(Document).filter(Document.id.in_(data.document_ids), Document.tenant_id == tenant_id).all()
    if not docs:
        raise HTTPException(status_code=404, detail="No documents found")

    updated = 0
    for doc in docs:
        valid = {
            "offerte": {"draft", "sent", "accepted", "rejected", "cancelled"},
            "rechnung": {"draft", "sent", "paid", "overdue", "cancelled"},
        }
        if data.status in valid.get(doc.document_type, set()):
            doc.status = data.status
            if data.status == "paid":
                from datetime import date as date_type
                doc.paid_at = data.paid_at or date_type.today()
                doc.payment_method = data.payment_method
                doc.payment_reference = data.payment_reference
            updated += 1

    db.commit()
    return {"updated": updated, "total": len(data.document_ids)}

@router.post("/bulk/send-email")
def bulk_send_email(data: BulkActionRequest, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    docs = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id.in_(data.document_ids), Document.tenant_id == tenant_id)
        .all()
    )
    company = _get_settings(db, tenant_id)
    from app.services.email_sender import send_document_email

    sent = 0
    errors = []
    for doc in docs:
        if not doc.client or not doc.client.email:
            errors.append(f"{doc.document_number}: no email")
            continue
        try:
            if not doc.portal_token:
                doc.generate_portal_token()
            pdf_buffer = generate_invoice_pdf(doc, company)
            pdf_buffer.seek(0)
            send_document_email(
                recipient_email=doc.client.email,
                recipient_name=doc.client.company_name,
                document=doc,
                pdf_bytes=pdf_buffer.read(),
                company=company,
            )
            if doc.status == "draft":
                doc.status = "sent"
            sent += 1
        except Exception as e:
            errors.append(f"{doc.document_number}: {str(e)}")

    db.commit()
    return {"sent": sent, "errors": errors}

@router.post("/bulk/pdf-zip")
def bulk_download_pdf_zip(data: BulkActionRequest, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    docs = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.id.in_(data.document_ids), Document.tenant_id == tenant_id)
        .all()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="No documents found")

    company = _get_settings(db, tenant_id)
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in docs:
            pdf_buf = generate_invoice_pdf(doc, company)
            pdf_buf.seek(0)
            type_label = "Rechnung" if doc.document_type == "rechnung" else "Offerte"
            client_slug = doc.client.company_name.replace(" ", "-").replace("/", "-") if doc.client else "Kunde"
            fname = f"{type_label}_{doc.document_number}_{client_slug}.pdf"
            zf.writestr(fname, pdf_buf.read())

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="documents.zip"'},
    )

# ── Recurring invoices helper ─────────────────────────
def _calc_next_recurrence(base_date, recurrence: str):
    from dateutil.relativedelta import relativedelta
    deltas = {
        "monthly": relativedelta(months=1),
        "quarterly": relativedelta(months=3),
        "yearly": relativedelta(years=1),
    }
    delta = deltas.get(recurrence)
    if not delta:
        return None
    return base_date + delta
