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
