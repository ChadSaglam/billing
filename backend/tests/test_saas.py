"""Signup, trials and plan enforcement — the SaaS surface."""

import datetime as dt

import pytest

from tests.conftest import needs_db

pytestmark = needs_db


def test_signup_creates_workspace_with_trial(client, db, make_workspace):
    ws = make_workspace("Trial Co")
    me = client.get("/api/auth/me", headers=ws["headers"]).json()

    assert me["tenant_name"] == "Trial Co"
    assert me["plan"] == "trial"
    assert me["trial_ends_at"] is not None


def test_signup_does_not_leak_a_previous_tenants_company_details(client, make_workspace):
    """A fresh workspace must start blank — never pre-filled with someone's IBAN."""
    ws = make_workspace("Blank Co")
    settings = client.get("/api/settings", headers=ws["headers"]).json()

    for field in ("iban", "uid", "street", "bank_name", "phone"):
        assert settings.get(field) in ("", None), f"{field} leaked a default: {settings.get(field)}"


def test_duplicate_company_name_gets_a_unique_slug(client, make_workspace):
    a = make_workspace("Same Name AG")
    b = make_workspace("Same Name AG")
    slug_a = client.get("/api/tenant", headers=a["headers"]).json()["slug"]
    slug_b = client.get("/api/tenant", headers=b["headers"]).json()["slug"]
    assert slug_a != slug_b


def test_workspace_reports_usage_against_the_plan(client, make_workspace):
    ws = make_workspace()
    body = client.get("/api/tenant", headers=ws["headers"]).json()

    assert body["plan"] == "trial"
    assert body["usage"]["users"]["used"] == 1
    assert body["usage"]["clients"]["used"] == 0
    assert body["usage"]["clients"]["limit"] == 10
    assert body["is_usable"] is True


def test_plans_endpoint_lists_the_price_book(client):
    plans = client.get("/api/tenant/plans").json()
    keys = {p["key"] for p in plans}
    assert {"trial", "starter", "pro", "business"} <= keys
    business = next(p for p in plans if p["key"] == "business")
    assert business["max_clients"] == -1


def test_client_limit_is_enforced(client, db, make_workspace):
    ws = make_workspace()
    # Trial allows 10 clients.
    for i in range(10):
        resp = client.post(
            "/api/clients",
            headers=ws["headers"],
            json={
                "customer_number": f"C-{i}",
                "company_name": f"Customer {i}",
                "street": "Teststrasse 1",
                "postal_code": "8000",
                "city": "Zürich",
                "country": "Schweiz",
            },
        )
        assert resp.status_code == 201, resp.text

    over = client.post(
        "/api/clients",
        headers=ws["headers"],
        json={
            "customer_number": "C-11",
            "company_name": "One Too Many",
            "street": "Teststrasse 1",
            "postal_code": "8000",
            "city": "Zürich",
            "country": "Schweiz",
        },
    )
    assert over.status_code == 402
    assert over.json()["detail"]["error"] == "plan_limit_reached"


def test_expired_trial_makes_the_workspace_read_only(client, db, make_workspace):
    ws = make_workspace("Expired Co")
    tenant_id = client.get("/api/tenant", headers=ws["headers"]).json()["id"]

    from app.models.tenant import Tenant

    tenant = db.get(Tenant, tenant_id)
    tenant.trial_ends_at = dt.datetime.utcnow() - dt.timedelta(days=1)
    db.flush()

    # Reads still work…
    assert client.get("/api/clients", headers=ws["headers"]).status_code == 200

    # …writes are blocked with a machine-readable reason.
    resp = client.post(
        "/api/clients",
        headers=ws["headers"],
        json={
            "customer_number": "X-1",
            "company_name": "Blocked",
            "street": "Teststrasse 1",
            "postal_code": "8000",
            "city": "Zürich",
            "country": "Schweiz",
        },
    )
    assert resp.status_code == 402
    assert resp.json()["detail"]["error"] == "trial_expired"


def test_upgrading_clears_the_trial_deadline(client, make_workspace):
    ws = make_workspace()
    body = client.post("/api/tenant/plan", headers=ws["headers"], json={"plan": "pro"}).json()
    assert body["plan"] == "pro"
    assert body["trial_ends_at"] is None
    assert body["usage"]["clients"]["limit"] == 500


def test_unknown_plan_is_rejected(client, make_workspace):
    ws = make_workspace()
    resp = client.post("/api/tenant/plan", headers=ws["headers"], json={"plan": "enterprise-plus"})
    assert resp.status_code == 400


@pytest.mark.parametrize("path", ["/api/tenant", "/api/tenant/plan"])
def test_tenant_endpoints_need_auth(client, path):
    method = client.get if path == "/api/tenant" else lambda p: client.post(p, json={"plan": "pro"})
    assert method(path).status_code == 401
