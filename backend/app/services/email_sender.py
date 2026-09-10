import logging
import smtplib
import ssl
from dataclasses import dataclass, field
from datetime import date as date_type
from decimal import Decimal
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

EMAIL_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f4f4f4; }}
  .container {{ max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; }}
  .header {{ background: #0f172a; color: #fff; padding: 24px 32px; }}
  .header h1 {{ margin: 0; font-size: 18px; font-weight: 600; }}
  .body {{ padding: 32px; }}
  .body p {{ line-height: 1.6; margin: 0 0 16px; }}
  .info-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
  .info-table td {{ padding: 10px 16px; border-bottom: 1px solid #e5e7eb; }}
  .info-table td:first-child {{ color: #6b7280; width: 140px; }}
  .info-table td:last-child {{ font-weight: 600; }}
  .total-row td {{ border-bottom: 2px solid #0f172a; font-size: 16px; }}
  .footer {{ padding: 24px 32px; background: #f9fafb; color: #6b7280; font-size: 13px; }}
  .btn {{ display: inline-block; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 8px; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>{company_name}</h1>
  </div>
  <div class="body">
    <p>Guten Tag {recipient_name},</p>
    <p>Im Anhang erhalten Sie unsere <strong>{type_label} Nr. {document_number}</strong>.</p>
    <table class="info-table">
      <tr><td>Dokument</td><td>{type_label} {document_number}</td></tr>
      <tr><td>Datum</td><td>{date}</td></tr>
      <tr><td>Fällig am</td><td>{due_date}</td></tr>
      <tr><td>Zahlungsfrist</td><td>{payment_terms} Tage</td></tr>
      <tr class="total-row"><td>Betrag</td><td>{currency} {total}</td></tr>
    </table>
    {portal_section}
    <p>Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.</p>
    <p>Freundliche Grüsse<br><strong>{company_name}</strong></p>
    {contact_section}
  </div>
  <div class="footer">
    <p>Diese E-Mail wurde automatisch von {company_name} versendet.</p>
  </div>
</div>
</body>
</html>
"""


@dataclass(frozen=True)
class DocumentEmail:
    """Everything the SMTP send needs, as plain values.

    Built in the request (`from_document`) and handed to a BackgroundTask.
    ORM instances must not cross that boundary: by the time the task runs
    the session is committed and closed, so every attribute access on an
    expired `Document` would raise DetachedInstanceError (R-67).
    """

    recipient_email: str
    recipient_name: str
    document_type: str
    document_number: str
    date: date_type | None
    due_date: date_type | None
    payment_terms_days: int | None
    currency: str
    total: Decimal
    portal_token: str | None
    company_name: str
    company_phone: str | None
    company_email: str | None
    pdf_bytes: bytes = field(repr=False)

    @classmethod
    def from_document(
        cls,
        document,  # Document model instance
        company,  # CompanySettings model instance
        pdf_bytes: bytes,
        recipient_email: str | None = None,
        recipient_name: str | None = None,
    ) -> "DocumentEmail":
        return cls(
            recipient_email=recipient_email or document.client.email,
            recipient_name=recipient_name or document.client.company_name,
            document_type=document.document_type,
            document_number=document.document_number,
            date=document.date,
            due_date=document.due_date,
            payment_terms_days=document.payment_terms_days,
            currency=document.currency,
            total=Decimal(document.total),
            portal_token=document.portal_token,
            company_name=company.company_name,
            company_phone=company.phone,
            company_email=company.email,
            pdf_bytes=pdf_bytes,
        )


def _make_filename(document_type: str, document_number: str, recipient_name: str) -> str:
    type_label = "Rechnung" if document_type == "rechnung" else "Offerte"
    client_slug = recipient_name.replace(" ", "-").replace("/", "-")
    return f"{type_label}_{document_number}_{client_slug}.pdf"


def send_document_email(email: DocumentEmail) -> None:
    """SMTP send. Safe to run in a BackgroundTask — needs no session."""
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP not configured — set SMTP_HOST and SMTP_PASSWORD in .env")

    type_label = "Rechnung" if email.document_type == "rechnung" else "Offerte"
    filename = _make_filename(email.document_type, email.document_number, email.recipient_name)
    subject = f"{type_label} Nr. {email.document_number} — {email.company_name}"

    portal_section = ""
    if email.portal_token:
        portal_url = f"{settings.FRONTEND_URL or 'http://localhost:5050'}/portal/{email.portal_token}"
        portal_section = f'<p>Sie können das Dokument auch online einsehen:</p><p><a class="btn" href="{portal_url}">Dokument online ansehen</a></p>'

    contact_parts = []
    if email.company_phone:
        contact_parts.append(f"Tel: {email.company_phone}")
    if email.company_email:
        contact_parts.append(f"E-Mail: {email.company_email}")
    contact_section = f'<p style="color:#6b7280;font-size:13px;margin-top:24px;">{" · ".join(contact_parts)}</p>' if contact_parts else ""

    def _fmt_amount(val):
        return f"{float(val):,.2f}".replace(",", "'")

    html_body = EMAIL_TEMPLATE.format(
        company_name=email.company_name,
        recipient_name=email.recipient_name,
        type_label=type_label,
        document_number=email.document_number,
        date=email.date.strftime("%d.%m.%Y") if email.date else "-",
        due_date=email.due_date.strftime("%d.%m.%Y") if email.due_date else "-",
        payment_terms=email.payment_terms_days,
        currency=email.currency,
        total=_fmt_amount(email.total),
        portal_section=portal_section,
        contact_section=contact_section,
    )

    msg = MIMEMultipart("mixed")
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = email.recipient_email
    msg["Subject"] = subject

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    pdf_part = MIMEApplication(email.pdf_bytes, _subtype="pdf")
    pdf_part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(pdf_part)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)

    logger.info("Email sent: %s %s → %s", type_label, email.document_number, email.recipient_email)


def send_document_emails(emails: list[DocumentEmail]) -> None:
    """Bulk background send: one failure must not stop the rest (R-73)."""
    for email in emails:
        try:
            send_document_email(email)
        except Exception:
            logger.exception(
                "Email failed: %s → %s", email.document_number, email.recipient_email
            )
