#!/usr/bin/env python3
# scripts/seed.py

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

import requests


def fail(message: str, detail: Any | None = None, code: int = 1) -> None:
    print(message, file=sys.stderr)
    if detail is not None:
        if isinstance(detail, (dict, list)):
            print(json.dumps(detail, indent=2, ensure_ascii=False), file=sys.stderr)
        else:
            print(str(detail), file=sys.stderr)
    raise SystemExit(code)


def as_decimal(value: Any, default: str = "0.00") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    return Decimal(str(value))


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ApiClient:
    def __init__(self, api_url: str, timeout: int = 30) -> None:
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

    def _request(self, method: str, path: str, expected: tuple[int, ...], **kwargs: Any) -> requests.Response:
        response = self.session.request(method, f"{self.api_url}{path}", timeout=self.timeout, **kwargs)
        if response.status_code not in expected:
            try:
                detail = response.json()
            except Exception:
                detail = response.text
            fail(f"{method} {path} failed with status {response.status_code}", detail)
        return response

    def health(self) -> None:
        self._request("GET", "/api/health", (200,))

    def register(self, email: str, password: str, full_name: str, company_name: str) -> None:
        payload = {
            "email": email,
            "password": password,
            "full_name": full_name,
            "company_name": company_name,
        }
        response = self.session.post(
            f"{self.api_url}/api/auth/register",
            json=payload,
            timeout=self.timeout,
        )
        if response.status_code in (200, 201, 400, 409):
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        fail("Register failed", detail)

    def login(self, email: str, password: str) -> None:
        response = self._request(
            "POST",
            "/api/auth/login",
            (200,),
            json={"email": email, "password": password},
        )
        data = response.json()
        token = data.get("access_token")
        if not token:
            fail("No access_token returned from login", data)
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def get_settings(self) -> dict[str, Any] | None:
        response = self.session.get(f"{self.api_url}/api/settings", timeout=self.timeout)
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            try:
                detail = response.json()
            except Exception:
                detail = response.text
            fail("GET /api/settings failed", detail)
        return response.json()

    def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("PUT", "/api/settings", (200,), json=payload).json()

    def complete_onboarding(self) -> Any:
        return self._request("POST", "/api/settings/onboarding-complete", (200,), json={}).json()

    def upload_logo(self, logo_path: Path) -> Any:
        content_type = mimetypes.guess_type(logo_path.name)[0] or "application/octet-stream"
        with logo_path.open("rb") as f:
            files = {"file": (logo_path.name, f, content_type)}
            return self._request("POST", "/api/settings/logo", (200,), files=files).json()

    def list_services(self) -> list[dict[str, Any]]:
        data = self._request("GET", "/api/services", (200,)).json()
        return data if isinstance(data, list) else data.get("items", [])

    def create_service(self, payload: dict[str, Any]) -> None:
        response = self.session.post(f"{self.api_url}/api/services", json=payload, timeout=self.timeout)
        if response.status_code in (200, 201, 409):
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        fail("Create service failed", detail)

    def list_clients(self) -> list[dict[str, Any]]:
        data = self._request("GET", "/api/clients", (200,)).json()
        return data if isinstance(data, list) else data.get("items", [])

    def create_client(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        response = self.session.post(f"{self.api_url}/api/clients", json=payload, timeout=self.timeout)
        if response.status_code in (200, 201):
            return response.json()
        if response.status_code == 409:
            return None
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        fail("Create client failed", detail)

    def list_documents(self) -> list[dict[str, Any]]:
        data = self._request("GET", "/api/documents", (200,)).json()
        return data if isinstance(data, list) else data.get("items", [])

    def create_document(self, payload: dict[str, Any]) -> None:
        response = self.session.post(f"{self.api_url}/api/documents", json=payload, timeout=self.timeout)
        if response.status_code in (200, 201, 409):
            return
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        fail("Create document failed", detail)


def load_seed(path: Path) -> dict[str, Any]:
    if not path.exists():
        fail(f"seed file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_settings_payload(seed: dict[str, Any]) -> dict[str, Any]:
    tenant = seed.get("tenant", {})
    bank = seed.get("bank_details", {})
    defaults = seed.get("defaults", {})
    templates = seed.get("templates", {})

    return {
        "company_name": tenant.get("company_name", ""),
        "street": tenant.get("street", ""),
        "postal_code": tenant.get("postal_code", ""),
        "city": tenant.get("city", ""),
        "country": tenant.get("country", ""),
        "uid": tenant.get("uid", ""),
        "email": tenant.get("email", ""),
        "phone": tenant.get("phone", ""),
        "website": tenant.get("website", ""),
        "bank_name": bank.get("bank_name", ""),
        "iban": bank.get("iban", ""),
        "bic": bank.get("bic_swift", ""),
        "default_hourly_rate": float(as_decimal(defaults.get("default_hourly_rate", 0))),
        "default_payment_terms_days": int(defaults.get("default_payment_terms_days", 30)),
        "next_invoice_number": int(defaults.get("next_invoice_number", 1)),
        "next_offerte_number": int(defaults.get("next_offerte_number", 1)),
        "active_pdf_template": templates.get("active_pdf_template", "modern"),
        "onboarding_completed": True,
    }


def normalize_service(service: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": service.get("name", ""),
        "category": service.get("category", ""),
        "description": service.get("description", ""),
        "unit": service.get("unit", "Stunde"),
        "default_price": float(as_decimal(service.get("default_price", 0))),
        "sort_order": int(service.get("sort_order", 1)),
        "is_active": bool(service.get("is_active", True)),
    }


def normalize_client(client: dict[str, Any]) -> dict[str, Any]:
    return {
        "customer_number": str(client.get("customer_number", "")),
        "company_name": client.get("company_name", ""),
        "street": client.get("street", ""),
        "postal_code": client.get("postal_code", ""),
        "city": client.get("city", ""),
        "country": client.get("country", "Schweiz"),
        "email": client.get("email"),
    }


def build_document_payload(doc: dict[str, Any], client_id: int) -> dict[str, Any]:
    line_items = doc.get("line_items", [])
    discount_percent = as_decimal(doc.get("discount_percent", 0))
    discount_amount = as_decimal(doc.get("discount_amount", 0))

    normalized_items = []
    computed_subtotal = Decimal("0.00")

    for idx, item in enumerate(line_items, start=1):
        quantity = as_decimal(item.get("quantity", 0))
        unit_price = as_decimal(item.get("unit_price", 0))
        total_price = item.get("total_price")
        if total_price is None:
            total_price_dec = money(quantity * unit_price)
        else:
            total_price_dec = money(as_decimal(total_price))
        computed_subtotal += total_price_dec
        normalized_items.append(
            {
                "position": int(item.get("position", idx)),
                "description": item.get("description", ""),
                "quantity": float(quantity),
                "unit_price": float(money(unit_price)),
                "total_price": float(total_price_dec),
                "unit": item.get("unit", "Stunde"),
            }
        )

    subtotal = money(as_decimal(doc.get("subtotal")) if doc.get("subtotal") is not None else computed_subtotal)

    if doc.get("total") is not None:
        total = money(as_decimal(doc["total"]))
    else:
        if discount_amount == Decimal("0.00") and discount_percent != Decimal("0.00"):
            discount_amount = money(subtotal * discount_percent / Decimal("100"))
        total = money(subtotal - discount_amount)

    doc_date = date.fromisoformat(doc["date"])
    payment_terms_days = int(doc.get("due_date_days", 30))
    due_date = doc.get("due_date")
    if due_date:
        due_date_value = due_date
    else:
        due_date_value = (doc_date + timedelta(days=payment_terms_days)).isoformat()

    return {
        "document_type": doc.get("document_type", "rechnung"),
        "document_number": str(doc.get("document_number", "")),
        "client_id": client_id,
        "date": doc_date.isoformat(),
        "due_date": due_date_value,
        "payment_terms_days": payment_terms_days,
        "status": doc.get("status", "draft"),
        "subtotal": float(subtotal),
        "discount_percent": float(discount_percent),
        "discount_amount": float(discount_amount),
        "total": float(total),
        "currency": doc.get("currency", "CHF"),
        "line_items": normalized_items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--seed-file", required=True)
    parser.add_argument("--admin-email", required=True)
    parser.add_argument("--admin-password", required=True)
    parser.add_argument("--logo-file", required=False)
    args = parser.parse_args()

    seed = load_seed(Path(args.seed_file))
    tenant = seed.get("tenant", {})
    admin = seed.get("admin", {})

    company_name = tenant.get("company_name") or ""
    full_name = admin.get("full_name") or "Admin User"

    client = ApiClient(args.api_url)

    summary = {
        "tenant": company_name,
        "created": {"services": 0, "clients": 0, "documents": 0},
        "skipped": {"services": 0, "clients": 0, "documents": 0},
        "logo_uploaded": False,
        "errors": [],
    }

    client.health()
    client.register(args.admin_email, args.admin_password, full_name, company_name)
    client.login(args.admin_email, args.admin_password)

    existing_settings = client.get_settings()
    if existing_settings is not None:
        client.update_settings(build_settings_payload(seed))
        if args.logo_file:
            logo_path = Path(args.logo_file)
            if logo_path.exists():
                client.upload_logo(logo_path)
                summary["logo_uploaded"] = True
        client.complete_onboarding()
    else:
        summary["errors"].append("settings record does not exist yet; skipping settings update, logo upload, and onboarding")

    existing_services = {item.get("name") for item in client.list_services()}
    for raw_service in seed.get("services", []):
        service = normalize_service(raw_service)
        if service["name"] in existing_services:
            summary["skipped"]["services"] += 1
            continue
        client.create_service(service)
        summary["created"]["services"] += 1

    existing_clients = client.list_clients()
    clients_by_number: dict[str, dict[str, Any]] = {
        str(item.get("customer_number")): item for item in existing_clients if item.get("customer_number") is not None
    }

    for raw_client in seed.get("clients", []):
        payload = normalize_client(raw_client)
        customer_number = payload["customer_number"]
        if customer_number in clients_by_number:
            summary["skipped"]["clients"] += 1
            continue
        created = client.create_client(payload)
        summary["created"]["clients"] += 1
        if created:
            clients_by_number[str(created.get("customer_number"))] = created

    refreshed_clients = client.list_clients()
    clients_by_number = {
        str(item.get("customer_number")): item for item in refreshed_clients if item.get("customer_number") is not None
    }

    existing_documents = {
        str(item.get("document_number"))
        for item in client.list_documents()
        if item.get("document_number") is not None
    }

    for raw_doc in seed.get("documents", []):
        document_number = str(raw_doc.get("document_number", ""))
        if document_number in existing_documents:
            summary["skipped"]["documents"] += 1
            continue

        client_customer_number = str(raw_doc.get("client_customer_number", ""))
        matched_client = clients_by_number.get(client_customer_number)
        if not matched_client:
            summary["errors"].append(
                f"client not found for document {document_number}: {client_customer_number}"
            )
            continue

        payload = build_document_payload(raw_doc, int(matched_client["id"]))
        client.create_document(payload)
        summary["created"]["documents"] += 1

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()