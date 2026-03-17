import smtplib
import ssl
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _make_filename(document_type: str, document_number: str, recipient_name: str) -> str:
    type_label = "Rechnung" if document_type == "rechnung" else "Offerte"
    client_slug = recipient_name.replace(" ", "-").replace("/", "-")
    return f"{type_label}_{document_number}_{client_slug}.pdf"


def send_document_email(
    recipient_email: str,
    recipient_name: str,
    document_type: str,
    document_number: str,
    pdf_bytes: bytes,
    sender_company: str,
) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP not configured — set SMTP_HOST and SMTP_PASSWORD in .env")

    type_label = "Rechnung" if document_type == "rechnung" else "Offerte"
    filename = _make_filename(document_type, document_number, recipient_name)
    subject = f"{type_label} Nr. {document_number} — {sender_company}"

    html_body = f"""\
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h2 style="margin: 0; font-weight: 600; color: #2563eb;">{sender_company}</h2>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">Guten Tag {recipient_name}</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Im Anhang erhalten Sie unsere <strong>{type_label} Nr. {document_number}</strong>.
  </p>
  <p style="font-size: 15px; line-height: 1.6;">
    Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin-top: 32px;">
    Freundliche Grüsse<br>
    <strong>{sender_company}</strong>
  </p>
  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    Diese E-Mail wurde automatisch von {sender_company} versendet.
  </div>
</div>"""

    text_body = (
        f"Guten Tag {recipient_name}\n\n"
        f"Im Anhang erhalten Sie unsere {type_label} Nr. {document_number}.\n\n"
        f"Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.\n\n"
        f"Freundliche Grüsse\n"
        f"{sender_company}"
    )

    msg = MIMEMultipart("mixed")
    msg["From"] = f"{sender_company} <{settings.FROM_EMAIL}>"
    msg["To"] = recipient_email
    msg["Subject"] = subject

    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(text_body, "plain", "utf-8"))
    body_part.attach(MIMEText(html_body, "html", "utf-8"))
    msg.attach(body_part)

    pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_attachment.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(pdf_attachment)

    context = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

    logger.info("Email sent to %s for %s %s", recipient_email, type_label, document_number)
