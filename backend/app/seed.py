from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.document import Document
from app.models.line_item import LineItem
from app.models.service_template import ServiceTemplate


def seed_services(db: Session) -> int:
    """Seed default service templates. Returns count created."""
    services = [
        # Development
        ServiceTemplate(name="Web Development", category="Development", description="Custom website development with responsive design", unit="Stunde", default_price=Decimal("250.00"), sort_order=1),
        ServiceTemplate(name="App Development", category="Development", description="Mobile application development for iOS and Android", unit="Stunde", default_price=Decimal("250.00"), sort_order=2),
        ServiceTemplate(name="Software Development", category="Development", description="Custom software and business application development", unit="Stunde", default_price=Decimal("250.00"), sort_order=3),
        ServiceTemplate(name="E-Commerce Development", category="Development", description="Online store development with payment integration", unit="Stunde", default_price=Decimal("250.00"), sort_order=4),
        ServiceTemplate(name="Web Design", category="Development", description="UI/UX design and visual branding for web", unit="Stunde", default_price=Decimal("250.00"), sort_order=5),
        # Consulting & Support
        ServiceTemplate(name="IT Consulting", category="Consulting", description="Strategic IT guidance, technology selection and planning", unit="Stunde", default_price=Decimal("250.00"), sort_order=1),
        ServiceTemplate(name="Technical Support", category="Consulting", description="Ongoing technical customer support", unit="Stunde", default_price=Decimal("250.00"), sort_order=2),
        ServiceTemplate(name="System Update", category="Consulting", description="Software and system updates and maintenance", unit="Stunde", default_price=Decimal("250.00"), sort_order=3),
        # Data & AI
        ServiceTemplate(name="Data Analysis & Visualization", category="Data & AI", description="Data analysis, trend identification and dashboard creation", unit="Stunde", default_price=Decimal("250.00"), sort_order=1),
        ServiceTemplate(name="AI Services", category="Data & AI", description="AI integration, machine learning solutions and automation", unit="Stunde", default_price=Decimal("250.00"), sort_order=2),
        # Infrastructure
        ServiceTemplate(name="ERP Systems", category="Infrastructure", description="ERP configuration and business process automation", unit="Stunde", default_price=Decimal("250.00"), sort_order=1),
        ServiceTemplate(name="Web Hosting", category="Infrastructure", description="Reliable web hosting with technical support", unit="Monat", default_price=Decimal("50.00"), sort_order=2),
        ServiceTemplate(name="Mobile Device Management", category="Infrastructure", description="MDM setup, security policies and device management", unit="Stunde", default_price=Decimal("250.00"), sort_order=3),
        ServiceTemplate(name="Hardware Systems", category="Infrastructure", description="Hardware solutions for data processing and expansion", unit="Stück", default_price=Decimal("500.00"), sort_order=4),
        ServiceTemplate(name="Security Cameras", category="Infrastructure", description="HD security camera installation and configuration", unit="Stück", default_price=Decimal("350.00"), sort_order=5),
        # Fixed-price items
        ServiceTemplate(name="Website (Pauschal)", category="Fixed Price", description="Complete website package", unit="Pauschal", default_price=Decimal("500.00"), sort_order=1),
    ]
    db.add_all(services)
    db.commit()
    return len(services)


def run_seed(db: Session) -> dict:
    """Seed the database with sample clients and invoices from the spec."""

    # --- Clients ---
    client1 = Client(
        customer_number="90014",
        company_name="Ammann + Schmid AG",
        street="Freiestrasse 39",
        postal_code="8610",
        city="Uster",
        country="Schweiz",
    )
    client2 = Client(
        customer_number="90012",
        company_name="RDS Isolierungen GmbH",
        street="Grüzefeldstrasse 51",
        postal_code="8404",
        city="Winterthur",
        country="Schweiz",
    )
    client3 = Client(
        customer_number="90025",
        company_name="Sky - Net Logistik GmbH",
        street="Bösch 21",
        postal_code="6331",
        city="Hünenberg",
        country="Schweiz",
        email="info@sky-net-logistik.ch",
    )

    db.add_all([client1, client2, client3])
    db.flush()

    # --- Invoice 1011 (Ammann + Schmid AG) ---
    inv_date_1 = date(2023, 12, 15)
    inv1 = Document(
        document_type="rechnung",
        document_number="1011",
        client_id=client1.id,
        date=inv_date_1,
        due_date=inv_date_1 + timedelta(days=30),
        payment_terms_days=30,
        status="paid",
        subtotal=Decimal("1500.00"),
        discount_percent=Decimal("0"),
        discount_amount=Decimal("0"),
        total=Decimal("1500.00"),
        currency="CHF",
    )
    db.add(inv1)
    db.flush()

    items_1 = [
        LineItem(
            document_id=inv1.id, position=1,
            description="Erstellt Kontaktseite einige Details Teil",
            quantity=Decimal("1"), unit_price=Decimal("250.00"),
            total_price=Decimal("250.00"), unit="Stunde",
        ),
        LineItem(
            document_id=inv1.id, position=2,
            description="Stilisierung der Kontaktseite / Styling Öffnungszeiten Details in header- und Footer",
            quantity=Decimal("1"), unit_price=Decimal("250.00"),
            total_price=Decimal("250.00"), unit="Stunde",
        ),
        LineItem(
            document_id=inv1.id, position=3,
            description="Responsive Probleme beendet",
            quantity=Decimal("3"), unit_price=Decimal("250.00"),
            total_price=Decimal("750.00"), unit="Stunde",
        ),
        LineItem(
            document_id=inv1.id, position=4,
            description="404 Seite erstellt",
            quantity=Decimal("1"), unit_price=Decimal("250.00"),
            total_price=Decimal("250.00"), unit="Stunde",
        ),
    ]
    db.add_all(items_1)

    # --- Invoice 1012 (RDS Isolierungen GmbH) ---
    inv_date_2 = date(2023, 12, 15)
    inv2 = Document(
        document_type="rechnung",
        document_number="1012",
        client_id=client2.id,
        date=inv_date_2,
        due_date=inv_date_2 + timedelta(days=30),
        payment_terms_days=30,
        status="paid",
        subtotal=Decimal("1250.00"),
        discount_percent=Decimal("0"),
        discount_amount=Decimal("0"),
        total=Decimal("1250.00"),
        currency="CHF",
    )
    db.add(inv2)
    db.flush()

    items_2 = [
        LineItem(
            document_id=inv2.id, position=1,
            description="Webseiten",
            quantity=Decimal("1"), unit_price=Decimal("500.00"),
            total_price=Decimal("500.00"), unit="Stück",
        ),
        LineItem(
            document_id=inv2.id, position=2,
            description="Beratungsgebühr (Stunde)",
            quantity=Decimal("1"), unit_price=Decimal("250.00"),
            total_price=Decimal("250.00"), unit="Stunde",
        ),
        LineItem(
            document_id=inv2.id, position=3,
            description="System Aktualisierung (Stunde)",
            quantity=Decimal("2"), unit_price=Decimal("250.00"),
            total_price=Decimal("500.00"), unit="Stunde",
        ),
    ]
    db.add_all(items_2)

    # --- Invoice 1325 (Sky - Net Logistik GmbH) ---
    inv_date_3 = date(2025, 6, 29)
    inv3 = Document(
        document_type="rechnung",
        document_number="1325",
        client_id=client3.id,
        date=inv_date_3,
        due_date=inv_date_3 + timedelta(days=10),
        payment_terms_days=10,
        status="sent",
        subtotal=Decimal("3500.00"),
        discount_percent=Decimal("13"),
        discount_amount=Decimal("455.00"),
        total=Decimal("3045.00"),
        currency="CHF",
    )
    db.add(inv3)
    db.flush()

    items_3 = [
        LineItem(
            document_id=inv3.id, position=1,
            description="Technischer Kundendienst(*Stunde)",
            quantity=Decimal("10"), unit_price=Decimal("250.00"),
            total_price=Decimal("2500.00"), unit="Stunde",
        ),
        LineItem(
            document_id=inv3.id, position=2,
            description="Beratungsgebühr(*Stunde)",
            quantity=Decimal("4"), unit_price=Decimal("250.00"),
            total_price=Decimal("1000.00"), unit="Stunde",
        ),
    ]
    db.add_all(items_3)

    # Seed service templates as well
    svc_count = seed_services(db)

    return {
        "clients_created": 3,
        "documents_created": 3,
        "line_items_created": len(items_1) + len(items_2) + len(items_3),
        "services_created": svc_count,
    }
