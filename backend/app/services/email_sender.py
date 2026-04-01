import smtplib
import ssl
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
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


def _make_filename(document_type: str, document_number: str, recipient_name: str) -> str:
    type_label = "Rechnung" if document_type == "rechnung" else "Offerte"
    client_slug = recipient_name.replace(" ", "-").replace("/", "-")
    return f"{type_label}_{document_number}_{client_slug}.pdf"


def send_document_email(
    recipient_email: str,
    recipient_name: str,
    document,  # Document model instance
    pdf_bytes: bytes,
    company,  # CompanySettings model instance
) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP not configured — set SMTP_HOST and SMTP_PASSWORD in .env")

    type_label = "Rechnung" if document.document_type == "rechnung" else "Offerte"
    filename = _make_filename(document.document_type, document.document_number, recipient_name)
    subject = f"{type_label} Nr. {document.document_number} — {company.company_name}"

    portal_section = ""
    if document.portal_token:
        portal_url = f"{settings.FRONTEND_URL or 'http://localhost:5173'}/portal/{document.portal_token}"
        portal_section = f'<p>Sie können das Dokument auch online einsehen:</p><p><a class="btn" href="{portal_url}">Dokument online ansehen</a></p>'

    contact_parts = []
    if company.phone:
        contact_parts.append(f"Tel: {company.phone}")
    if company.email:
        contact_parts.append(f"E-Mail: {company.email}")
    contact_section = f'<p style="color:#6b7280;font-size:13px;margin-top:24px;">{" · ".join(contact_parts)}</p>' if contact_parts else ""

    def _fmt_amount(val):
        return f"{float(val):,.2f}".replace(",", "'")

    html_body = EMAIL_TEMPLATE.format(
        company_name=company.company_name,
        recipient_name=recipient_name,
        type_label=type_label,
        document_number=document.document_number,
        date=document.date.strftime("%d.%m.%Y") if document.date else "-",
        due_date=document.due_date.strftime("%d.%m.%Y") if document.due_date else "-",
        payment_terms=document.payment_terms_days,
        currency=document.currency,
        total=_fmt_amount(document.total),
        portal_section=portal_section,
        contact_section=contact_section,
    )

    msg = MIMEMultipart("mixed")
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = recipient_email
    msg["Subject"] = subject

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    pdf_part = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(pdf_part)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)

    logger.info(f"Email sent: {type_label} {document.document_number} → {recipient_email}")
