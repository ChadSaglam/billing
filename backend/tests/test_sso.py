"""SSO hand-off, issuer side (R-103, chadev-platform/contracts/sso.md)."""

import re
from urllib.parse import urlsplit

import pytest
from jose import jwt

from app.api.sso import SSO_TOKEN_TTL_SECONDS, platform_role
from app.config import settings
from app.models.tenant import Tenant
from app.models.user import User

SECRET = "platform-test-secret"  # noqa: S105 - test fixture


@pytest.fixture
def platform_configured(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_SHARED_SECRET", SECRET)
    monkeypatch.setattr(settings, "BUCHHALTUNG_URL", "http://localhost:3000/")


def _launch(client, headers, app="buchhaltung"):
    return client.get("/api/sso/launch", params={"app": app}, headers=headers)


def _token_from(url: str) -> str:
    parts = urlsplit(url)
    assert parts.fragment.startswith("token=")
    return parts.fragment.removeprefix("token=")


def test_launch_404_when_unconfigured(client, make_tenant, monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_SHARED_SECRET", None)
    monkeypatch.setattr(settings, "BUCHHALTUNG_URL", "http://localhost:3000")
    t = make_tenant()
    resp = _launch(client, t["headers"])
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "http_404"
    assert client.get("/api/sso/apps", headers=t["headers"]).json() == []


def test_launch_404_without_target_url(client, make_tenant, monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_SHARED_SECRET", SECRET)
    monkeypatch.setattr(settings, "BUCHHALTUNG_URL", None)
    t = make_tenant()
    assert _launch(client, t["headers"]).status_code == 404
    assert client.get("/api/sso/apps", headers=t["headers"]).json() == []


def test_launch_404_for_unknown_app(client, make_tenant, platform_configured):
    t = make_tenant()
    assert _launch(client, t["headers"], app="nope").status_code == 404


def test_launch_requires_auth(client, platform_configured):
    assert _launch(client, {}).status_code == 401


def test_apps_lists_buchhaltung_when_configured(client, make_tenant, platform_configured):
    t = make_tenant()
    body = client.get("/api/sso/apps", headers=t["headers"]).json()
    assert body == [{"id": "buchhaltung", "name": "Buchhaltung", "url": "http://localhost:3000"}]


def test_launch_mints_contract_token(client, db, make_tenant, platform_configured):
    t = make_tenant()
    resp = _launch(client, t["headers"])
    assert resp.status_code == 200, resp.text
    url = resp.json()["url"]
    assert url.startswith("http://localhost:3000/sso#token=")
    token = _token_from(url)

    # The token is signed with the platform secret, never the app's own key.
    with pytest.raises(jwt.JWTError):
        jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"], audience="buchhaltung")
    claims = jwt.decode(token, SECRET, algorithms=["HS256"], audience="buchhaltung", issuer="billing")

    user = db.query(User).filter(User.email == t["credentials"]["email"]).one()
    tenant = db.get(Tenant, user.tenant_id)

    assert claims["iss"] == "billing"
    assert claims["aud"] == "buchhaltung"
    assert claims["type"] == "sso"
    assert claims["sub"] == str(user.id)
    assert claims["email"] == user.email
    assert claims["name"] == user.full_name
    assert claims["tid"] == tenant.id
    assert claims["role"] == "admin"
    assert claims["exp"] - claims["iat"] == SSO_TOKEN_TTL_SECONDS == 120
    assert re.fullmatch(r"[0-9a-f]{32}", claims["jti"])


def test_tenant_snapshot_fields(client, db, make_tenant, platform_configured):
    t = make_tenant()
    user = db.query(User).filter(User.email == t["credentials"]["email"]).one()
    tenant = db.get(Tenant, user.tenant_id)
    claims = jwt.decode(
        _token_from(_launch(client, t["headers"]).json()["url"]),
        SECRET,
        algorithms=["HS256"],
        audience="buchhaltung",
    )
    snapshot = claims["tenant"]
    assert set(snapshot) == {"name", "slug", "subscription_plan", "trial_ends_at"}
    assert snapshot["name"] == tenant.name
    assert snapshot["slug"] == tenant.slug
    assert snapshot["subscription_plan"] == tenant.subscription_plan == "trial"
    assert snapshot["trial_ends_at"] == tenant.trial_ends_at.replace(microsecond=0).isoformat() + "Z"


def test_tenant_snapshot_without_trial(client, db, make_tenant, platform_configured):
    t = make_tenant()
    user = db.query(User).filter(User.email == t["credentials"]["email"]).one()
    tenant = db.get(Tenant, user.tenant_id)
    tenant.subscription_plan = "pro"
    tenant.trial_ends_at = None
    db.commit()
    claims = jwt.decode(
        _token_from(_launch(client, t["headers"]).json()["url"]),
        SECRET,
        algorithms=["HS256"],
        audience="buchhaltung",
    )
    assert claims["tenant"]["subscription_plan"] == "pro"
    assert claims["tenant"]["trial_ends_at"] is None


def test_every_jti_is_unique(client, make_tenant, platform_configured):
    t = make_tenant()
    jtis = {
        jwt.decode(
            _token_from(_launch(client, t["headers"]).json()["url"]),
            SECRET,
            algorithms=["HS256"],
            audience="buchhaltung",
        )["jti"]
        for _ in range(3)
    }
    assert len(jtis) == 3


@pytest.mark.parametrize(
    ("billing_role", "expected"),
    [
        ("owner", "owner"),
        ("admin", "admin"),
        ("editor", "editor"),
        ("viewer", "viewer"),
        ("weird", "viewer"),
        (None, "viewer"),
    ],
)
def test_role_mapping(billing_role, expected):
    assert platform_role(billing_role) == expected


def test_launch_carries_the_users_role(client, db, make_tenant, platform_configured):
    t = make_tenant()
    user = db.query(User).filter(User.email == t["credentials"]["email"]).one()
    user.role = "editor"
    db.commit()
    claims = jwt.decode(
        _token_from(_launch(client, t["headers"]).json()["url"]),
        SECRET,
        algorithms=["HS256"],
        audience="buchhaltung",
    )
    assert claims["role"] == "editor"
