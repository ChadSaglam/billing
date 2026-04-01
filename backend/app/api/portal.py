from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.document import Document
from app.models.settings import CompanySettings
from app.schemas.document import PortalDocumentRead
from app.services.pdf_generator import generate_invoice_pdf

router = APIRouter(prefix="/api/portal", tags=["portal"])


def _get_doc_by_token(db: Session, token: str) -> Document:
    doc = (
        db.query(Document)
        .options(joinedload(Document.line_items), joinedload(Document.client))
        .filter(Document.portal_token == token)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or link expired")
    return doc


@router.get("/{token}", response_model=PortalDocumentRead)
def get_portal_document(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(db, token)
    company = db.query(CompanySettings).filter(CompanySettings.tenant_id == doc.tenant_id).first()
    result = PortalDocumentRead.model_validate(doc)
    result.company_name = company.company_name if company else None
    return result


@router.get("/{token}/pdf")
def download_portal_pdf(token: str, db: Session = Depends(get_db)):
    doc = _get_doc_by_token(db, token)
    settings = db.query(CompanySettings).filter(CompanySettings.tenant_id == doc.tenant_id).first()
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
