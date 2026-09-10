def test_register_then_login(client, make_tenant):
    tenant = make_tenant()
    resp = client.post(
        "/api/auth/login",
        json={
            "email": tenant["credentials"]["email"],
            "password": tenant["credentials"]["password"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_login_with_wrong_password_is_rejected(client, make_tenant):
    tenant = make_tenant()
    resp = client.post(
        "/api/auth/login",
        json={"email": tenant["credentials"]["email"], "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_protected_endpoint_requires_token(client):
    assert client.get("/api/clients").status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client, make_tenant):
    tenant = make_tenant()
    login = client.post(
        "/api/auth/login",
        json={
            "email": tenant["credentials"]["email"],
            "password": tenant["credentials"]["password"],
        },
    ).json()
    headers = {"Authorization": f"Bearer {login['refresh_token']}"}
    assert client.get("/api/clients", headers=headers).status_code == 401


def test_access_token_has_platform_claims(client, make_tenant):
    """chadev-platform/contracts/auth.md: {sub, tid, role, type, exp, jti}."""
    from jose import jwt

    from app.config import settings

    t = make_tenant()
    token = t["headers"]["Authorization"].split()[1]
    claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert {"sub", "tid", "role", "type", "exp", "jti"} <= set(claims)
    assert claims["type"] == "access"
    assert claims["role"] in ("owner", "admin", "editor", "viewer")
    assert len(claims["jti"]) == 32
