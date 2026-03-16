import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

from app.models.document import Document
from app.models.settings import CompanySettings


def _fmt_decimal(val: Decimal) -> str:
    """Format decimal as Swiss number: 1'250.00"""
    formatted = f"{val:,.2f}"
    return formatted.replace(",", "'")


def _fmt_date(d) -> str:
    """Format date as DD.MM.YYYY"""
    if d is None:
        return ""
    return d.strftime("%d.%m.%Y")


def _register_fonts():
    """Try to register Helvetica (already built-in to ReportLab)."""
    pass


def generate_invoice_pdf(document: Document, settings: CompanySettings) -> io.BytesIO:
    buffer = io.BytesIO()
    _register_fonts()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=25 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        name="CompanyHeader",
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1a1a1a"),
    ))
    styles.add(ParagraphStyle(
        name="DocTitle",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        spaceAfter=6 * mm,
    ))
    styles.add(ParagraphStyle(
        name="BodyText2",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name="SmallText",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#666666"),
    ))
    styles.add(ParagraphStyle(
        name="RightAligned",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="Footer",
        fontName="Helvetica",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#888888"),
        alignment=TA_CENTER,
    ))

    elements = []
    type_label = "Rechnung" if document.document_type == "rechnung" else "Offerte"

    # --- Company header ---
    elements.append(Paragraph(settings.company_name, styles["CompanyHeader"]))
    elements.append(Spacer(1, 3 * mm))

    # Company details line
    company_line = f"{settings.street} | {settings.postal_code} {settings.city} | {settings.email} | {settings.phone}"
    elements.append(Paragraph(company_line, styles["SmallText"]))
    elements.append(Spacer(1, 10 * mm))

    # --- Address and details block ---
    client = document.client

    # Client address (left) and document details (right) as a table
    client_address = f"""<b>{client.company_name}</b><br/>
{f'{client.contact_person}<br/>' if client.contact_person else ''}{client.street}<br/>
{client.postal_code} {client.city}<br/>
{client.country}"""

    doc_details = f"""<b>{type_label} Nr.</b> {document.document_number}<br/>
<b>Datum:</b> {_fmt_date(document.date)}<br/>
<b>Kundennummer:</b> {client.customer_number}<br/>
<b>UID:</b> {settings.uid}"""

    header_table = Table(
        [[Paragraph(client_address, styles["BodyText2"]),
          Paragraph(doc_details, styles["RightAligned"])]],
        colWidths=[95 * mm, 70 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 12 * mm))

    # --- Location and date ---
    elements.append(Paragraph(
        f"{settings.city}, {_fmt_date(document.date)}",
        styles["BodyText2"],
    ))
    elements.append(Spacer(1, 8 * mm))

    # --- Document title ---
    elements.append(Paragraph(
        f"{type_label} Nr. {document.document_number}",
        styles["DocTitle"],
    ))

    # --- Greeting ---
    if document.document_type == "rechnung":
        greeting = "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag."
    else:
        greeting = "Sehr geehrte Damen und Herren, gerne unterbreiten wir Ihnen folgende Offerte."
    elements.append(Paragraph(greeting, styles["BodyText2"]))
    elements.append(Spacer(1, 6 * mm))

    # --- Line items table ---
    table_header = ["Pos", "Bezeichnung / Beschreibung", "Menge", "Preis/Stück", "Positionspreis"]
    table_data = [table_header]

    for item in document.line_items:
        unit_label = f"{_fmt_decimal(item.quantity)} {item.unit}"
        table_data.append([
            str(item.position),
            item.description,
            unit_label,
            f"{_fmt_decimal(item.unit_price)} CHF",
            f"{_fmt_decimal(item.total_price)} CHF",
        ])

    col_widths = [12 * mm, 72 * mm, 25 * mm, 28 * mm, 28 * mm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 12),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        # Grid
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.black),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.black),
        ("LINEAFTER", (0, 0), (-2, -1), 0.25, colors.HexColor("#cccccc")),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4 * mm))

    # --- Totals ---
    totals_data = []
    totals_data.append(["", "", "", "Zwischensumme:", f"{_fmt_decimal(document.subtotal)} CHF"])

    if document.discount_percent and document.discount_percent > 0:
        totals_data.append([
            "", "", "",
            f"Preisnachlass ({_fmt_decimal(document.discount_percent)}%):",
            f"-{_fmt_decimal(document.discount_amount)} CHF",
        ])

    totals_data.append(["", "", "", f"{type_label}betrag:", f"{_fmt_decimal(document.total)} CHF"])

    totals_table = Table(totals_data, colWidths=col_widths)
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (-2, -1), (-1, -1), 0.5, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8 * mm))

    # --- Payment note ---
    if document.document_type == "rechnung":
        payment_note = (
            f"Wir bitten Sie um Überweisung des Rechnungsbetrages innerhalb von "
            f"{document.payment_terms_days} Tagen."
        )
        elements.append(Paragraph(payment_note, styles["BodyText2"]))
        elements.append(Spacer(1, 6 * mm))

    # --- Notes ---
    if document.notes:
        elements.append(Paragraph(document.notes, styles["BodyText2"]))
        elements.append(Spacer(1, 6 * mm))

    # --- Closing ---
    elements.append(Paragraph("Mit freundlichen Grüssen,", styles["BodyText2"]))
    elements.append(Paragraph(settings.company_name, styles["BodyText2"]))
    elements.append(Spacer(1, 15 * mm))

    # --- Footer ---
    footer_text = (
        f"{settings.company_name} | {settings.street} | {settings.postal_code} {settings.city} | "
        f"UID: {settings.uid}<br/>"
        f"{settings.bank_name} | IBAN: {settings.iban} | BIC: {settings.bic}<br/>"
        f"{settings.email} | {settings.phone} | {settings.website}"
    )
    elements.append(Paragraph(footer_text, styles["Footer"]))

    # --- Page 2: QR-bill ---
    elements.append(PageBreak())
    _add_qr_bill_page(elements, document, settings, styles)

    doc.build(elements)
    return buffer


def _add_qr_bill_page(
    elements: list,
    document: Document,
    settings: CompanySettings,
    styles,
):
    """Add Swiss QR-bill payment slip as page 2."""
    elements.append(Paragraph("Zahlteil / Payment part", styles["DocTitle"]))
    elements.append(Spacer(1, 5 * mm))

    # Generate QR code
    try:
        _add_qr_code(elements, document, settings, styles)
    except Exception:
        elements.append(Paragraph(
            "QR-Bill generation requires the qrbill library. "
            "Please install it: pip install qrbill",
            styles["BodyText2"],
        ))
        return

    elements.append(Spacer(1, 10 * mm))

    # Payment information table
    iban_clean = settings.iban.replace(" ", "")
    info_data = [
        ["Konto / Zahlbar an:", f"{iban_clean}"],
        ["", f"{settings.company_name}"],
        ["", f"{settings.street}"],
        ["", f"{settings.postal_code} {settings.city}"],
        ["", ""],
        ["Zahlbar durch:", f"{document.client.company_name}"],
        ["", f"{document.client.street}"],
        ["", f"{document.client.postal_code} {document.client.city}"],
        ["", ""],
        ["Referenz:", f"{document.document_type.upper()} {document.document_number}"],
        ["Betrag:", f"CHF {_fmt_decimal(document.total)}"],
    ]

    info_table = Table(info_data, colWidths=[45 * mm, 120 * mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(info_table)


def _add_qr_code(elements, document, settings, styles):
    """Generate and add Swiss QR code to the document."""
    try:
        from qrbill import QRBill

        iban_clean = settings.iban.replace(" ", "")

        bill = QRBill(
            account=iban_clean,
            creditor={
                "name": settings.company_name,
                "street": settings.street,
                "pcode": settings.postal_code,
                "city": settings.city,
                "country": "CH",
            },
            amount=str(document.total),
            currency=document.currency,
            debtor={
                "name": document.client.company_name,
                "street": document.client.street,
                "pcode": document.client.postal_code,
                "city": document.client.city,
                "country": "CH",
            },
            additional_information=f"{document.document_type.upper()} {document.document_number}",
        )

        # Save QR bill as SVG to buffer, then render info
        svg_buffer = io.BytesIO()
        bill.as_svg(svg_buffer)
        svg_data = svg_buffer.getvalue()

        # Since embedding SVG directly into ReportLab is complex,
        # render the QR data manually using qrcode library
        _render_qr_with_qrcode(elements, document, settings, styles)

    except ImportError:
        # Fallback: render QR code using qrcode library directly
        _render_qr_with_qrcode(elements, document, settings, styles)
    except Exception:
        _render_qr_with_qrcode(elements, document, settings, styles)


def _render_qr_with_qrcode(elements, document, settings, styles):
    """Render QR code using the qrcode library and ReportLab."""
    try:
        import qrcode
        from reportlab.graphics.shapes import Drawing, Rect
        from reportlab.graphics import renderPDF

        iban_clean = settings.iban.replace(" ", "")

        # Swiss QR code payload (SPC format)
        qr_data = "\n".join([
            "SPC",  # QR Type
            "0200",  # Version
            "1",  # Coding Type (UTF-8)
            iban_clean,  # IBAN
            "K",  # Creditor Address Type (combined)
            settings.company_name,
            f"{settings.street}",
            f"{settings.postal_code} {settings.city}",
            "",  # empty
            "",  # empty
            "CH",  # Country
            "",  # Ultimate Creditor fields (7 empty lines)
            "", "", "", "", "", "",
            str(document.total),
            document.currency,
            "K",  # Debtor Address Type
            document.client.company_name,
            document.client.street,
            f"{document.client.postal_code} {document.client.city}",
            "",
            "",
            "CH",
            "NON",  # Reference Type
            "",  # Reference
            f"{document.document_type.upper()} {document.document_number}",
            "EPD",  # Trailer
        ])

        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=2, border=1)
        qr.add_data(qr_data)
        qr.make(fit=True)
        matrix = qr.get_matrix()

        # Draw QR code as a ReportLab Drawing
        size = len(matrix)
        cell_size = 1.5
        drawing_size = size * cell_size
        d = Drawing(drawing_size * mm, drawing_size * mm)

        for row_idx, row in enumerate(matrix):
            for col_idx, cell in enumerate(row):
                if cell:
                    d.add(Rect(
                        col_idx * cell_size * mm,
                        (size - 1 - row_idx) * cell_size * mm,
                        cell_size * mm,
                        cell_size * mm,
                        fillColor=colors.black,
                        strokeColor=colors.black,
                        strokeWidth=0,
                    ))

        # Add Swiss cross in center
        cross_size = 7 * mm
        center = drawing_size * mm / 2
        d.add(Rect(
            center - cross_size / 2,
            center - cross_size / 2,
            cross_size,
            cross_size,
            fillColor=colors.white,
            strokeColor=colors.black,
            strokeWidth=0.5,
        ))
        d.add(Rect(
            center - cross_size / 2 + 1.5 * mm,
            center - 1 * mm,
            cross_size - 3 * mm,
            2 * mm,
            fillColor=colors.black,
            strokeColor=colors.black,
            strokeWidth=0,
        ))
        d.add(Rect(
            center - 1 * mm,
            center - cross_size / 2 + 1.5 * mm,
            2 * mm,
            cross_size - 3 * mm,
            fillColor=colors.black,
            strokeColor=colors.black,
            strokeWidth=0,
        ))

        elements.append(d)

    except ImportError:
        elements.append(Paragraph(
            "[QR Code - requires 'qrcode' library: pip install qrcode]",
            styles["BodyText2"],
        ))
