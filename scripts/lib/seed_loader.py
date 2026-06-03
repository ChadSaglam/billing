#!/usr/bin/env python3
"""Dynamic seed loader. Run with backend on PYTHONPATH."""
import argparse
import json
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.database import SessionLocal
from app.models.client import Client
from app.models.document import Document
from app.models.line_item import LineItem
from app.models.service_template import ServiceTemplate
from app.models.user import User
from app.auth import hash_password
from app.database import engine, Base
from app.models.tenant import Tenant

# Settings model is optional — seed it only if the schema supports it
try:
    from app.models.settings import Settings as SettingsModel
    _HAS_SETTINGS = True
except ImportError:
    _HAS_SETTINGS = False


def to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(v) for v in obj]
    return obj


def run(seed_path: str, client_slug: str, tenant_id: int):
    # Drop all existing tables and recreate them from the current models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("All tables dropped and recreated.")
    
    with open(seed_path, "r", encoding="utf-8") as f:
        data = to_decimal(json.load(f))

    db = SessionLocal()
    tenant_id = 1  # database-per-client makes this safe

    try:
        # 0) Create tenant from seed data
        t_data = data.get("tenant", {})
        if t_data:
            tenant = Tenant(
                id=tenant_id,
                name=t_data.get("company_name"),
                slug=client_slug,
            )
            db.add(tenant)
            db.flush()
            print(f"Created tenant: {t_data.get('company_name')} (slug={client_slug})")

        # 1) Admin user
        a = data.get("admin", {})
        if a and a.get("email") and a.get("password"):
            hashed = hash_password(a["password"])
            user = User(
                tenant_id=tenant_id,
                email=a["email"],
                hashed_password=hashed,
                full_name=a.get("full_name", "Admin"),
                is_active=True,
            )
            db.add(user)
            db.flush()
            print(f"Created admin user: {a['email']}")

        # 2) Optional company settings
        if _HAS_SETTINGS:
            try:
                settings = SettingsModel(tenant_id=tenant_id, onboarding_completed=False)
                db.add(settings)
                db.flush()
                print("Created default settings.")
            except Exception as e:
                print(f"WARN: Could not create settings: {e}")

        # 3) Services
        svc_data = data.get("services", [])
        for svc in svc_data:
            db.add(ServiceTemplate(tenant_id=tenant_id, **svc))
        db.flush()
        print(f"Created {len(svc_data)} services.")

        # 4) Clients
        client_map = {}
        for c in data.get("clients", []):
            client = Client(tenant_id=tenant_id, **{k: v for k, v in c.items() if v is not None})
            db.add(client)
            db.flush()
            client_map[c["customer_number"]] = client.id

        # 5) Documents + Line Items
        for d in data.get("documents", []):
            line_items = d.pop("line_items", [])
            cust_no = d.pop("client_customer_number")
            client_id = client_map.get(cust_no)
            if not client_id:
                print(f"WARN: customer_number {cust_no} not found, skipping document")
                continue

            due_days = d.pop("due_date_days", 30)
            doc_date = d.pop("date")

            computed_subtotal = Decimal("0")
            line_objs = []
            for li in line_items:
                qty = li.get("quantity", Decimal("1"))
                up = li.get("unit_price", Decimal("0"))
                tp = li.get("total_price", (qty * up).quantize(Decimal("0.01")))
                line_objs.append({
                    "position": li["position"],
                    "description": li["description"],
                    "quantity": qty,
                    "unit_price": up,
                    "total_price": tp,
                    "unit": li.get("unit", "Stunde"),
                })
                computed_subtotal += tp

            subtotal = d.pop("subtotal", None) or computed_subtotal
            discount_percent = d.pop("discount_percent", Decimal("0"))
            discount_amount = d.pop("discount_amount", None)
            if discount_amount is None and discount_percent:
                discount_amount = (subtotal * discount_percent / Decimal("100")).quantize(Decimal("0.01"))
            total = d.pop("total", None) or (subtotal - (discount_amount or Decimal("0")))

            doc = Document(
                tenant_id=tenant_id,
                client_id=client_id,
                date=date.fromisoformat(doc_date),
                due_date=date.fromisoformat(doc_date) + timedelta(days=due_days),
                subtotal=subtotal,
                discount_percent=discount_percent,
                discount_amount=discount_amount or Decimal("0"),
                total=total,
                **{k: v for k, v in d.items() if v is not None},
            )
            db.add(doc)
            db.flush()

            for li in line_objs:
                db.add(LineItem(document_id=doc.id, **li))

        db.commit()
        print(f"SUCCESS: tenant_id={tenant_id} seeded.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--tenant-id", type=int, default=1)
    p.add_argument("--seed", required=True)
    p.add_argument("--slug", required=True)
    args = p.parse_args()
    run(args.seed, args.slug)