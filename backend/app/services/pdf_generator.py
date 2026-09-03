import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.document import Document
from app.models.settings import CompanySettings
from app.services.qr_reference import generate_creditor_reference

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
    for _name, style in custom.items():
        styles.add(style)
    return styles

def _generate_classic_pdf(document: Document, settings: CompanySettings) -> io.BytesIO:
    """Clean minimal template — no color accent, traditional Swiss business style."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=25 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=25 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("DocTitle", fontName="Helvetica-Bold", fontSize=14, leading=18, spaceAfter=2 * mm))
    styles.add(ParagraphStyle("Meta", fontName="Helvetica", fontSize=9, leading=12, textColor=colors.HexColor("#555555")))
    styles.add(ParagraphStyle("MetaBold", fontName="Helvetica-Bold", fontSize=9, leading=12))
    styles.add(ParagraphStyle("Addr", fontName="Helvetica", fontSize=10, leading=14))
    styles.add(ParagraphStyle("CellR", fontName="Helvetica", fontSize=9, leading=12, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellRB", fontName="Helvetica-Bold", fontSize=9, leading=12, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("Cell", fontName="Helvetica", fontSize=9, leading=12))
    styles.add(ParagraphStyle("Foot", fontName="Helvetica", fontSize=7, leading=9, textColor=colors.HexColor("#888888"), alignment=TA_CENTER))

    elements = []
    type_label = "Rechnung" if document.document_type == "rechnung" else "Offerte"
    client = document.client

    # Header — company name left-aligned, simple
    elements.append(Paragraph(f"<b>{settings.company_name}</b>", ParagraphStyle("H", fontName="Helvetica-Bold", fontSize=16, leading=20)))
    elements.append(Paragraph(
        f"{settings.street} · {settings.postal_code} {settings.city} · {settings.phone} · {settings.email}",
        styles["Meta"]
    ))
    elements.append(Spacer(1, 1 * mm))

    # Thin line
    line = Table([[""]], colWidths=[165 * mm], rowHeights=[0.5])
    line.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#cccccc"))]))
    elements.append(line)
    elements.append(Spacer(1, 12 * mm))

    # Client address + meta
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
    meta_html = "".join(f"<b>{label}</b> {value}<br/>" for label, value in meta_rows)

    addr_meta = Table(
        [[Paragraph(client_block, styles["Addr"]), Paragraph(meta_html, styles["Meta"])]],
        colWidths=[95 * mm, 70 * mm],
    )
    addr_meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(addr_meta)
    elements.append(Spacer(1, 15 * mm))

    # Title
    elements.append(Paragraph(f"{type_label} Nr. {document.document_number}", styles["DocTitle"]))
    elements.append(Spacer(1, 2 * mm))

    greeting = (
        "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag. Für die von Ihnen beauftragten Tätigkeiten berechnen wir Ihnen wie folgt:"
        if document.document_type == "rechnung"
        else "Sehr geehrte Damen und Herren, gerne unterbreiten wir Ihnen folgende Offerte:"
    )
    elements.append(Paragraph(greeting, styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))

    # Line items — simple black/white table
    col_widths = [12 * mm, 72 * mm, 20 * mm, 28 * mm, 30 * mm]
    hdr_style = ParagraphStyle("TH", fontName="Helvetica-Bold", fontSize=8.5, leading=11)
    header_row = [
        Paragraph("Pos.", hdr_style),
        Paragraph("Bezeichnung", hdr_style),
        Paragraph("Menge", hdr_style),
        Paragraph("Einzelpreis", hdr_style),
        Paragraph("Gesamtpreis", hdr_style),
    ]
    table_data = [header_row]
    for item in document.line_items:
        table_data.append([
            Paragraph(str(item.position), styles["Cell"]),
            Paragraph(item.description, styles["Cell"]),
            Paragraph(f"{_fmt(item.quantity)} {item.unit}", styles["CellR"]),
            Paragraph(f"{_fmt(item.unit_price)} CHF", styles["CellR"]),
            Paragraph(f"{_fmt(item.total_price)} CHF", styles["CellR"]),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.black),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        *[("LINEBELOW", (0, i), (-1, i), 0.25, colors.HexColor("#eeeeee"))
          for i in range(1, len(table_data) - 1)],
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # Totals
    totals_data = [["", "", "", Paragraph("Zwischensumme", styles["CellR"]), Paragraph(f"{_fmt(document.subtotal)} CHF", styles["CellR"])]]
    if document.discount_percent and document.discount_percent > 0:
        totals_data.append(["", "", "", Paragraph(f"Rabatt ({_fmt(document.discount_percent)}%)", styles["CellR"]), Paragraph(f"–{_fmt(document.discount_amount)} CHF", styles["CellR"])])
    totals_data.append(["", "", "", Paragraph(f"<b>{type_label}betrag</b>", styles["CellRB"]), Paragraph(f"<b>{_fmt(document.total)} CHF</b>", styles["CellRB"])])

    totals_table = Table(totals_data, colWidths=col_widths)
    totals_table.setStyle(TableStyle([
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (-2, -1), (-1, -1), 1, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8 * mm))

    if document.document_type == "rechnung":
        elements.append(Paragraph(
            f"Wir bitten Sie um Überweisung des Rechnungsbetrages innerhalb von {document.payment_terms_days} Tagen.",
            styles["Normal"],
        ))
        elements.append(Spacer(1, 4 * mm))

    if document.notes:
        elements.append(Paragraph(f"<b>Hinweis:</b> {document.notes}", styles["Normal"]))
        elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("Mit freundlichen Grüssen", styles["Normal"]))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(f"<b>{settings.company_name}</b>", styles["Normal"]))
    elements.append(Spacer(1, 15 * mm))

    elements.append(line)
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(
        f"{settings.company_name} · {settings.street} · {settings.postal_code} {settings.city} · UID: {settings.uid}<br/>"
        f"{settings.bank_name} · IBAN: {settings.iban} · BIC: {settings.bic}<br/>"
        f"{settings.email} · {settings.phone} · {settings.website}",
        styles["Foot"],
    ))

    if document.document_type == "rechnung":
        elements.append(PageBreak())
        _add_qr_bill_page(elements, document, settings, _build_styles())

    doc.build(elements)
    return buffer

def _generate_modern_pdf(document: Document, settings: CompanySettings) -> io.BytesIO:
    buffer = io.BytesIO()
    styles = _build_styles()
    elements = []
    type_label = "Rechnung" if document.document_type == "rechnung" else "Offerte"
    client = document.client

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=25 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=25 * mm,
    )

    # ── HEADER ──
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

    line_table = Table([[""]], colWidths=[165 * mm], rowHeights=[1.5])
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_COLOR),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(Spacer(1, 3 * mm))
    elements.append(line_table)
    elements.append(Spacer(1, 12 * mm))

    # ── CLIENT + DOC META ──
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

    greeting = (
        "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag. Für die von Ihnen beauftragten Tätigkeiten berechnen wir Ihnen wie folgt:"
        if document.document_type == "rechnung"
        else "Sehr geehrte Damen und Herren, gerne unterbreiten wir Ihnen folgende Offerte:"
    )
    elements.append(Paragraph(greeting, styles["Body"]))
    elements.append(Spacer(1, 6 * mm))

    # ── LINE ITEMS ──
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
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        *[("BACKGROUND", (0, i), (-1, i), LIGHT_BG)
          for i in range(2, len(table_data), 2)],
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, -1), (-1, -1), 0.75, BORDER_COLOR),
        ("LINEABOVE", (0, 0), (-1, 0), 0, ACCENT_COLOR),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # ── TOTALS ──
    totals_data = [
        ["", "", "",
         Paragraph("Zwischensumme", styles["TableCellRight"]),
         Paragraph(f"{_fmt(document.subtotal)} CHF", styles["TableCellRight"])],
    ]
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

    # ── PAYMENT NOTE ──
    if document.document_type == "rechnung":
        elements.append(Paragraph(
            f"Wir bitten Sie um Überweisung des Rechnungsbetrages innerhalb von "
            f"{document.payment_terms_days} Tagen.",
            styles["Body"],
        ))
        elements.append(Spacer(1, 4 * mm))

    if document.notes:
        elements.append(Paragraph(f"<b>Hinweis:</b> {document.notes}", styles["Body"]))
        elements.append(Spacer(1, 4 * mm))

    # ── CLOSING ──
    elements.append(Paragraph("Mit freundlichen Grüssen", styles["Body"]))
    elements.append(Spacer(1, 2 * mm))
    elements.append(Paragraph(f"<b>{settings.company_name}</b>", styles["Body"]))
    elements.append(Spacer(1, 15 * mm))

    # ── FOOTER ──
    elements.append(line_table)
    elements.append(Spacer(1, 2 * mm))
    footer_text = (
        f"{settings.company_name} · {settings.street} · {settings.postal_code} {settings.city} · "
        f"UID: {settings.uid}<br/>"
        f"{settings.bank_name} · IBAN: {settings.iban} · BIC: {settings.bic}<br/>"
        f"{settings.email} · {settings.phone} · {settings.website}"
    )
    elements.append(Paragraph(footer_text, styles["Footer"]))

    # ── PAGE 2: QR BILL ──
    if document.document_type == "rechnung":
        elements.append(PageBreak())
        _add_qr_bill_page(elements, document, settings, styles)

    doc.build(elements)
    return buffer

def generate_invoice_pdf(document: Document, settings: CompanySettings) -> io.BytesIO:
    template = getattr(settings, 'pdf_template', 'modern') or 'modern'
    if template == 'classic':
        return _generate_classic_pdf(document, settings)
    return _generate_modern_pdf(document, settings)


def _add_qr_bill_page(elements, document, settings, styles):
    """Swiss QR payment slip per SIX Group spec v2.3."""
    import qrcode

    from app.services.qr_reference import format_creditor_reference

    iban_clean = settings.iban.replace(" ", "").upper()
    creditor_name = settings.company_name[:70]
    creditor_address = settings.street[:70]
    creditor_zip = settings.postal_code[:16]
    creditor_city = settings.city[:35]
    debtor_name = document.client.company_name[:70]
    debtor_address = document.client.street[:70]
    debtor_zip = document.client.postal_code[:16]
    debtor_city = document.client.city[:35]
    debtor_country = (document.client.country or "CH")[:2].upper()
    amount = f"{document.total:.2f}"
    currency = document.currency or "CHF"
    creditor_ref = generate_creditor_reference(document.document_number)
    creditor_ref_display = format_creditor_reference(creditor_ref)
    ref_info = f"{document.document_type.upper()} {document.document_number}"

    # SPC QR payload — SIX Group v2.3 spec
    # Fields: Header(3) + CdtrInf(1) + Cdtr(7) + UltmtCdtr(7) + CcyAmt(2) + UltmtDbtr(7) + RmtInf(3) + AltPmt(0-2)
    qr_lines = [
        "SPC",                    # QRType
        "0200",                   # Version
        "1",                      # Coding (UTF-8)
        iban_clean,               # IBAN
        # Creditor (S = structured)
        "S",                      # Address type
        creditor_name,            # Name
        creditor_address,         # Street
        "",                       # Building number (combined in street)
        creditor_zip,             # Postal code
        creditor_city,            # City
        "CH",                     # Country
        # Ultimate Creditor (empty per spec — reserved)
        "", "", "", "", "", "", "",
        # Amount
        amount,                   # Amount
        currency,                 # Currency
        # Ultimate Debtor
        "S",                      # Address type
        debtor_name,
        debtor_address,
        "",                       # Building number
        debtor_zip,
        debtor_city,
        debtor_country,
        # Reference
        "SCOR",                   # Reference type (ISO 11649)
        creditor_ref,             # Reference (no empty field between type and value)
        # Additional info
        ref_info,                 # Unstructured message
        "EPD",                    # End payment data
    ]
    qr_data = "\r\n".join(qr_lines)

    # Generate QR with Swiss cross
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=0)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_pil = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # Add Swiss cross overlay (7x7mm area in center per spec)
    qr_w, qr_h = qr_pil.size
    cross_size = int(qr_w * 0.18)
    cross_border = max(1, cross_size // 12)
    cx, cy = qr_w // 2, qr_h // 2
    half = cross_size // 2
    arm_w = max(1, cross_size // 3)
    arm_half = arm_w // 2

    # White square background
    for x in range(cx - half - cross_border, cx + half + cross_border + 1):
        for y in range(cy - half - cross_border, cy + half + cross_border + 1):
            if 0 <= x < qr_w and 0 <= y < qr_h:
                qr_pil.putpixel((x, y), (255, 255, 255))

    # Black square
    for x in range(cx - half, cx + half + 1):
        for y in range(cy - half, cy + half + 1):
            if 0 <= x < qr_w and 0 <= y < qr_h:
                qr_pil.putpixel((x, y), (0, 0, 0))

    # White cross
    for x in range(cx - arm_half, cx + arm_half + 1):
        for y in range(cy - half + cross_border + 1, cy + half - cross_border):
            if 0 <= x < qr_w and 0 <= y < qr_h:
                qr_pil.putpixel((x, y), (255, 255, 255))
    for x in range(cx - half + cross_border + 1, cx + half - cross_border):
        for y in range(cy - arm_half, cy + arm_half + 1):
            if 0 <= x < qr_w and 0 <= y < qr_h:
                qr_pil.putpixel((x, y), (255, 255, 255))

    qr_buffer = io.BytesIO()
    qr_pil.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    qr_image = Image(qr_buffer, width=46 * mm, height=46 * mm)

    # Styles
    title_s = ParagraphStyle("QRT", fontName="Helvetica-Bold", fontSize=11, leading=13)
    label_s = ParagraphStyle("QRL", fontName="Helvetica-Bold", fontSize=6, leading=8)
    value_s = ParagraphStyle("QRV", fontName="Helvetica", fontSize=8, leading=10)
    label_big = ParagraphStyle("QRLB", fontName="Helvetica-Bold", fontSize=8, leading=10)
    value_big = ParagraphStyle("QRVB", fontName="Helvetica", fontSize=10, leading=12)
    scissor_s = ParagraphStyle("Scissor", fontName="Helvetica", fontSize=7, leading=9,
                               textColor=colors.HexColor("#999999"), alignment=TA_CENTER)

    elements.append(Spacer(1, 162 * mm))

    # Scissor line
    elements.append(Paragraph("✂  Vor der Einzahlung abzutrennen", scissor_s))
    dash_line = Table([[""]], colWidths=[165 * mm], rowHeights=[0.5])
    dash_line.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#999999")),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(dash_line)
    elements.append(Spacer(1, 5 * mm))

    # ── Empfangsschein (Receipt) — 62mm wide ──
    RECEIPT_W = 62 * mm
    receipt_items = [
        [Paragraph("Empfangsschein", title_s)],
        [Spacer(1, 2 * mm)],
        [Paragraph("Konto / Zahlbar an", label_s)],
        [Paragraph(f"{iban_clean}<br/>{creditor_name}<br/>{creditor_address}<br/>{creditor_zip} {creditor_city}", value_s)],
        [Spacer(1, 1.5 * mm)],
        [Paragraph("Referenz", label_s)],
        [Paragraph(creditor_ref_display, value_s)],
        [Spacer(1, 1.5 * mm)],
        [Paragraph("Zahlbar durch", label_s)],
        [Paragraph(f"{debtor_name}<br/>{debtor_address}<br/>{debtor_zip} {debtor_city}", value_s)],
        [Spacer(1, 2 * mm)],
        [Paragraph("Währung          Betrag", label_s)],
        [Paragraph(f"{currency}                    {_fmt(document.total)}", value_s)],
        [Spacer(1, 3 * mm)],
        [Paragraph("<b>Annahmestelle</b>", label_s)],
    ]
    receipt_table = Table(receipt_items, colWidths=[RECEIPT_W])
    receipt_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    # ── Zahlteil (Payment) ──
    pay_left_items = [
        [Paragraph("Zahlteil", title_s)],
        [Spacer(1, 2 * mm)],
        [qr_image],
        [Spacer(1, 3 * mm)],
        [Paragraph("Währung          Betrag", label_big)],
        [Paragraph(f"{currency}                    {_fmt(document.total)}", value_big)],
    ]
    pay_left = Table(pay_left_items, colWidths=[56 * mm])
    pay_left.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    pay_right_items = [
        [Spacer(1, 16 * mm)],
        [Paragraph("Konto / Zahlbar an", label_big)],
        [Paragraph(f"{iban_clean}<br/>{creditor_name}<br/>{creditor_address}<br/>{creditor_zip} {creditor_city}", value_big)],
        [Spacer(1, 1.5 * mm)],
        [Paragraph("Referenz", label_big)],
        [Paragraph(creditor_ref_display, value_big)],
        [Spacer(1, 1.5 * mm)],
        [Paragraph("Zahlbar durch", label_big)],
        [Paragraph(f"{debtor_name}<br/>{debtor_address}<br/>{debtor_zip} {debtor_city}", value_big)],
        [Spacer(1, 1.5 * mm)],
        [Paragraph("Zusätzliche Informationen", label_big)],
        [Paragraph(ref_info, value_big)],
    ]
    pay_right = Table(pay_right_items, colWidths=[46 * mm])
    pay_right.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    zahlteil = Table([[pay_left, pay_right]], colWidths=[56 * mm, 46 * mm])
    zahlteil.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))

    main_slip = Table(
        [[receipt_table, zahlteil]],
        colWidths=[RECEIPT_W, 103 * mm],
    )
    main_slip.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, colors.HexColor("#999999")),
    ]))

    elements.append(main_slip)