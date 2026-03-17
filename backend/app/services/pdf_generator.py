import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Spacer, Paragraph, PageBreak, Image
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.document import Document
from app.models.settings import CompanySettings

BRAND_COLOR = colors.HexColor("#1a1a2e")
ACCENT_COLOR = colors.HexColor("#0f3460")
LIGHT_BG = colors.HexColor("#f8f9fa")
BORDER_COLOR = colors.HexColor("#dee2e6")
MUTED = colors.HexColor("#6c757d")


def _fmt(val: Decimal) -> str:
    return f"{val:,.2f}".replace(",", "'")


def _fmt_date(d) -> str:
    return d.strftime("%d.%m.%Y") if d else ""


def _build_styles():
    styles = getSampleStyleSheet()
    custom = {
        "CompanyName": ParagraphStyle(
            "CompanyName", fontName="Helvetica-Bold", fontSize=20,
            leading=24, textColor=BRAND_COLOR,
        ),
        "CompanyDetail": ParagraphStyle(
            "CompanyDetail", fontName="Helvetica", fontSize=8,
            leading=11, textColor=MUTED,
        ),
        "DocTitle": ParagraphStyle(
            "DocTitle", fontName="Helvetica-Bold", fontSize=22,
            leading=26, textColor=BRAND_COLOR, spaceAfter=2 * mm,
        ),
        "DocMeta": ParagraphStyle(
            "DocMeta", fontName="Helvetica", fontSize=9,
            leading=13, textColor=MUTED,
        ),
        "DocMetaBold": ParagraphStyle(
            "DocMetaBold", fontName="Helvetica-Bold", fontSize=9,
            leading=13, textColor=BRAND_COLOR,
        ),
        "Body": ParagraphStyle(
            "Body", fontName="Helvetica", fontSize=10, leading=14,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader", fontName="Helvetica-Bold", fontSize=8.5,
            leading=11, textColor=colors.white,
        ),
        "TableCell": ParagraphStyle(
            "TableCell", fontName="Helvetica", fontSize=9, leading=12,
        ),
        "TableCellRight": ParagraphStyle(
            "TableCellRight", fontName="Helvetica", fontSize=9,
            leading=12, alignment=TA_RIGHT,
        ),
        "TableCellBold": ParagraphStyle(
            "TableCellBold", fontName="Helvetica-Bold", fontSize=9,
            leading=12, alignment=TA_RIGHT,
        ),
        "Footer": ParagraphStyle(
            "Footer", fontName="Helvetica", fontSize=7, leading=9,
            textColor=MUTED, alignment=TA_CENTER,
        ),
        "Address": ParagraphStyle(
            "Address", fontName="Helvetica", fontSize=10, leading=14,
        ),
        "SmallLabel": ParagraphStyle(
            "SmallLabel", fontName="Helvetica-Bold", fontSize=7,
            leading=9, textColor=MUTED, spaceAfter=1 * mm,
        ),
    }
    for name, style in custom.items():
        styles.add(style)
    return styles


def generate_invoice_pdf(document: Document, settings: CompanySettings) -> io.BytesIO:
    buffer = io.BytesIO()
    page_w, page_h = A4

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=25 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=25 * mm,
    )

    styles = _build_styles()
    elements = []
    type_label = "Rechnung" if document.document_type == "rechnung" else "Offerte"
    client = document.client

    # ── HEADER: Company name + details ──
    company_detail = (
        f"{settings.street} · {settings.postal_code} {settings.city} · "
        f"{settings.phone} · {settings.email}"
    )
    header_table = Table(
        [[
            Paragraph(settings.company_name, styles["CompanyName"]),
            Paragraph(company_detail, styles["CompanyDetail"]),
        ]],
        colWidths=[80 * mm, 85 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)

    # Accent line
    line_table = Table([[""]], colWidths=[165 * mm], rowHeights=[1.5])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_COLOR),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(Spacer(1, 3 * mm))
    elements.append(line_table)
    elements.append(Spacer(1, 12 * mm))

    # ── CLIENT + DOC META side by side ──
    client_block = (
        f"<b>{client.company_name}</b><br/>"
        f"{f'{client.contact_person}<br/>' if client.contact_person else ''}"
        f"{client.street}<br/>"
        f"{client.postal_code} {client.city}<br/>"
        f"{client.country}"
    )

    meta_rows = [
        ("Datum:", _fmt_date(document.date)),
        ("Fällig:", _fmt_date(document.due_date) if document.due_date else "—"),
        ("Kunden-Nr.:", client.customer_number),
        ("UID:", settings.uid),
    ]
    meta_html = "".join(
        f'<font face="Helvetica" color="#6c757d" size="8">{label}</font> '
        f'<font face="Helvetica-Bold" size="9">{val}</font><br/>'
        for label, val in meta_rows
    )

    addr_meta = Table(
        [[Paragraph(client_block, styles["Address"]), Paragraph(meta_html, styles["Body"])]],
        colWidths=[95 * mm, 70 * mm],
    )
    addr_meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(addr_meta)
    elements.append(Spacer(1, 15 * mm))

    # ── TITLE ──
    elements.append(Paragraph(f"{type_label} Nr. {document.document_number}", styles["DocTitle"]))
    elements.append(Spacer(1, 2 * mm))

    # Greeting
    if document.document_type == "rechnung":
        greeting = "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag. Für die von Ihnen beauftragten Tätigkeiten berechnen wir Ihnen wie folgt:"
    else:
        greeting = "Sehr geehrte Damen und Herren, gerne unterbreiten wir Ihnen folgende Offerte:"
    elements.append(Paragraph(greeting, styles["Body"]))
    elements.append(Spacer(1, 6 * mm))

    # ── LINE ITEMS TABLE ──
    col_widths = [12 * mm, 72 * mm, 20 * mm, 28 * mm, 30 * mm]

    header_row = [
        Paragraph("Pos.", styles["TableHeader"]),
        Paragraph("Bezeichnung", styles["TableHeader"]),
        Paragraph("Menge", styles["TableHeader"]),
        Paragraph("Einzelpreis", styles["TableHeader"]),
        Paragraph("Gesamtpreis", styles["TableHeader"]),
    ]
    table_data = [header_row]

    for item in document.line_items:
        table_data.append([
            Paragraph(str(item.position), styles["TableCell"]),
            Paragraph(item.description, styles["TableCell"]),
            Paragraph(f"{_fmt(item.quantity)} {item.unit}", styles["TableCellRight"]),
            Paragraph(f"{_fmt(item.unit_price)} CHF", styles["TableCellRight"]),
            Paragraph(f"{_fmt(item.total_price)} CHF", styles["TableCellRight"]),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        # Alternating rows
        *[("BACKGROUND", (0, i), (-1, i), LIGHT_BG)
          for i in range(2, len(table_data), 2)],
        # General
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        # Bottom line
        ("LINEBELOW", (0, -1), (-1, -1), 0.75, BORDER_COLOR),
        # Rounded header effect via top line
        ("LINEABOVE", (0, 0), (-1, 0), 0, ACCENT_COLOR),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # ── TOTALS ──
    totals_data = []
    totals_data.append([
        "", "", "",
        Paragraph("Zwischensumme", styles["TableCellRight"]),
        Paragraph(f"{_fmt(document.subtotal)} CHF", styles["TableCellRight"]),
    ])
    if document.discount_percent and document.discount_percent > 0:
        totals_data.append([
            "", "", "",
            Paragraph(f"Rabatt ({_fmt(document.discount_percent)}%)", styles["TableCellRight"]),
            Paragraph(f"–{_fmt(document.discount_amount)} CHF", styles["TableCellRight"]),
        ])
    totals_data.append([
        "", "", "",
        Paragraph(f"<b>{type_label}betrag</b>", styles["TableCellBold"]),
        Paragraph(f"<b>{_fmt(document.total)} CHF</b>", styles["TableCellBold"]),
    ])

    totals_table = Table(totals_data, colWidths=col_widths)
    totals_table.setStyle(TableStyle([
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (-2, -1), (-1, -1), 1, BRAND_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8 * mm))

    # ── PAYMENT NOTE / NOTES ──
    if document.document_type == "rechnung":
        elements.append(Paragraph(
            f"Wir bitten Sie um Überweisung des Rechnungsbetrages innerhalb von "
            f"{document.payment_terms_days} Tagen.",
            styles["Body"],
        ))
        elements.append(Spacer(1, 4 * mm))

    if document.notes:
        elements.append(Paragraph(
            f"<b>Hinweis:</b> {document.notes}", styles["Body"],
        ))
        elements.append(Spacer(1, 4 * mm))

    # ── CLOSING ──
    elements.append(Paragraph("Mit freundlichen Grüssen", styles["Body"]))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(f"<b>{settings.company_name}</b>", styles["Body"]))
    elements.append(Spacer(1, 15 * mm))

    # ── FOOTER LINE ──
    elements.append(line_table)
    elements.append(Spacer(1, 2 * mm))
    footer_text = (
        f"{settings.company_name} · {settings.street} · {settings.postal_code} {settings.city} · "
        f"UID: {settings.uid}<br/>"
        f"{settings.bank_name} · IBAN: {settings.iban} · BIC: {settings.bic}<br/>"
        f"{settings.email} · {settings.phone} · {settings.website}"
    )
    elements.append(Paragraph(footer_text, styles["Footer"]))

    # ── PAGE 2: SWISS QR BILL ──
    if document.document_type == "rechnung":
        elements.append(PageBreak())
        _add_qr_bill_page(elements, document, settings, styles)

    doc.build(elements)
    return buffer


def _add_qr_bill_page(elements, document, settings, styles):
    """Generate Swiss QR payment slip on a dedicated page."""
    import qrcode
    from reportlab.platypus import KeepTogether

    iban_clean = settings.iban.replace(" ", "")
    creditor_name = settings.company_name
    creditor_address = f"{settings.street}"
    creditor_zip = settings.postal_code
    creditor_city = settings.city
    debtor_name = document.client.company_name
    debtor_address = document.client.street
    debtor_zip = document.client.postal_code
    debtor_city = document.client.city
    amount = f"{document.total:.2f}"
    currency = document.currency
    ref_info = f"{document.document_type.upper()} {document.document_number}"

    # Build SPC QR payload (Swiss Payment Code)
    qr_data = "\n".join([
        "SPC",                    # QR Type
        "0200",                   # Version
        "1",                      # Coding (UTF-8)
        iban_clean,               # IBAN
        "S",                      # Creditor address type (structured)
        creditor_name,
        creditor_address,
        "",                       # Building number (combined in street)
        creditor_zip,
        creditor_city,
        "CH",                     # Creditor country
        "",                       # Ultimate creditor (empty)
        "",
        "",
        "",
        "",
        "",
        "",
        amount,
        currency,
        "S",                      # Debtor address type
        debtor_name,
        debtor_address,
        "",
        debtor_zip,
        debtor_city,
        "CH",
        "NON",                    # Reference type
        "",                       # Reference
        ref_info,                 # Additional info
        "EPD",                    # Trailer
    ])

    # Generate QR code image
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=3, border=0)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_image = Image(qr_buffer, width=46 * mm, height=46 * mm)

    # Swiss cross overlay placeholder (visual only)
    SLIP_W = 165 * mm
    RECEIPT_W = 52 * mm
    PAYMENT_W = SLIP_W - RECEIPT_W - 2 * mm

    section_title = ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=11, leading=13, textColor=BRAND_COLOR)
    slip_label = ParagraphStyle("SlipLabel", fontName="Helvetica-Bold", fontSize=6, leading=8, textColor=colors.black)
    slip_value = ParagraphStyle("SlipValue", fontName="Helvetica", fontSize=8, leading=10, textColor=colors.black)
    slip_label_big = ParagraphStyle("SlipLabelBig", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.black)
    slip_value_big = ParagraphStyle("SlipValueBig", fontName="Helvetica", fontSize=10, leading=12, textColor=colors.black)
    slip_title = ParagraphStyle("SlipTitle", fontName="Helvetica-Bold", fontSize=11, leading=13, textColor=colors.black)

    # ── Payment info header ──
    elements.append(Spacer(1, 10 * mm))
    elements.append(Paragraph(
        f"Zahlungsinformationen – Rechnung Nr. {document.document_number}",
        styles["DocTitle"],
    ))
    elements.append(Spacer(1, 5 * mm))
    elements.append(Paragraph(
        f"Bitte verwenden Sie den untenstehenden Einzahlungsschein für die Überweisung "
        f"von <b>CHF {_fmt(document.total)}</b> auf unser Konto.",
        styles["Body"],
    ))
    elements.append(Spacer(1, 15 * mm))

    # ── Separator line (dashed) ──
    sep_table = Table([[""]], colWidths=[SLIP_W], rowHeights=[0.5])
    sep_table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.black),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(sep_table)
    elements.append(Spacer(1, 5 * mm))

    # ── Build the payment slip (Empfangsschein + Zahlteil) ──
    # LEFT: Empfangsschein (receipt)
    receipt_content = []
    receipt_content.append(Paragraph("Empfangsschein", slip_title))
    receipt_content.append(Spacer(1, 3 * mm))
    receipt_content.append(Paragraph("Konto / Zahlbar an", slip_label))
    receipt_content.append(Paragraph(f"{iban_clean}<br/>{creditor_name}<br/>{creditor_address}<br/>{creditor_zip} {creditor_city}", slip_value))
    receipt_content.append(Spacer(1, 2 * mm))
    receipt_content.append(Paragraph("Zahlbar durch", slip_label))
    receipt_content.append(Paragraph(f"{debtor_name}<br/>{debtor_address}<br/>{debtor_zip} {debtor_city}", slip_value))
    receipt_content.append(Spacer(1, 3 * mm))
    receipt_content.append(Paragraph("Währung", slip_label))
    receipt_content.append(Paragraph(currency, slip_value))
    receipt_content.append(Paragraph("Betrag", slip_label))
    receipt_content.append(Paragraph(f"{_fmt(document.total)}", slip_value))
    receipt_content.append(Spacer(1, 3 * mm))
    receipt_content.append(Paragraph("<b>Annahmestelle</b>", slip_label))

    receipt_block = []
    for item in receipt_content:
        receipt_block.append([item])
    receipt_table = Table(receipt_block, colWidths=[RECEIPT_W])
    receipt_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    # RIGHT: Zahlteil (payment section with QR)
    payment_content = []
    payment_content.append(Paragraph("Zahlteil", slip_title))
    payment_content.append(Spacer(1, 3 * mm))
    payment_content.append(qr_image)
    payment_content.append(Spacer(1, 3 * mm))
    payment_content.append(Paragraph("Währung", slip_label_big))
    payment_content.append(Paragraph(currency, slip_value_big))
    payment_content.append(Paragraph("Betrag", slip_label_big))
    payment_content.append(Paragraph(f"{_fmt(document.total)}", slip_value_big))

    # Right column of Zahlteil: account info
    payment_info = []
    payment_info.append(Paragraph("Konto / Zahlbar an", slip_label_big))
    payment_info.append(Paragraph(f"{iban_clean}<br/>{creditor_name}<br/>{creditor_address}<br/>{creditor_zip} {creditor_city}", slip_value_big))
    payment_info.append(Spacer(1, 2 * mm))
    payment_info.append(Paragraph("Zahlbar durch", slip_label_big))
    payment_info.append(Paragraph(f"{debtor_name}<br/>{debtor_address}<br/>{debtor_zip} {debtor_city}", slip_value_big))
    payment_info.append(Spacer(1, 2 * mm))
    payment_info.append(Paragraph("Zusätzliche Informationen", slip_label_big))
    payment_info.append(Paragraph(ref_info, slip_value_big))

    # QR + amounts on left, account info on right
    left_col = []
    for item in payment_content:
        left_col.append([item])
    left_table = Table(left_col, colWidths=[56 * mm])
    left_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    right_col = []
    for item in payment_info:
        right_col.append([item])
    right_table = Table(right_col, colWidths=[52 * mm])
    right_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    zahlteil_table = Table([[left_table, right_table]], colWidths=[56 * mm, 52 * mm])
    zahlteil_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))

    # Combine receipt + payment
    main_slip = Table(
        [[receipt_table, zahlteil_table]],
        colWidths=[RECEIPT_W + 2 * mm, PAYMENT_W],
    )
    main_slip.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, colors.black),
    ]))

    elements.append(main_slip)

def _add_fallback_payment_info(elements, document, settings, styles):
    """Fallback if QR bill generation fails — show payment details as text."""
    iban_clean = settings.iban.replace(" ", "")
    elements.append(Spacer(1, 20 * mm))
    elements.append(Paragraph("Zahlungsinformationen", styles["DocTitle"]))
    elements.append(Spacer(1, 5 * mm))

    info_data = [
        ["Konto / Zahlbar an:", f"{iban_clean}"],
        ["", settings.company_name],
        ["", f"{settings.street}"],
        ["", f"{settings.postal_code} {settings.city}"],
        ["", ""],
        ["Zahlbar durch:", document.client.company_name],
        ["", document.client.street],
        ["", f"{document.client.postal_code} {document.client.city}"],
        ["", ""],
        ["Währung:", document.currency],
        ["Betrag:", f"CHF {_fmt(document.total)}"],
        ["Referenz:", f"{document.document_type.upper()} {document.document_number}"],
    ]

    info_table = Table(info_data, colWidths=[45 * mm, 120 * mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LEADING", (0, 0), (-1, -1), 14),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(info_table)
