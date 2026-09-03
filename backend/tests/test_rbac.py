"""Role enforcement (R-07). A viewer must not be able to write anything."""
import uuid

import pytest

from app.auth import hash_password
from app.models.user import User


def _client_payload():
    return {
        "customer_number": f"K-{uuid.uuid4().hex[:8]}",
        "company_name": "RBAC Test AG",
        "street": "Teststrasse 1",
        "postal_code": "8000",
        "city": "Zürich",
    }


@pytest.fixture
def viewer_headers(client, db, make_tenant):
    """A viewer account inside an existing tenant."""
    owner = make_tenant()
    admin = db.query(User).filter(User.email == owner["credentials"]["email"]).one()

    password = "V1ewerPass!x"  # noqa: S105 - test fixture credential
    viewer = User(
        email=f"viewer-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Read Only",
        hashed_password=hash_password(password),
        role="viewer",
        tenant_id=admin.tenant_id,
    )
    db.add(viewer)
    db.flush()

    token = client.post(
        "/api/auth/login", json={"email": viewer.email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, owner["headers"]


def test_viewer_can_read(client, viewer_headers):
    viewer, _admin = viewer_headers
    assert client.get("/api/clients", headers=viewer).status_code == 200
    assert client.get("/api/documents", headers=viewer).status_code == 200


def test_viewer_cannot_create_client(client, viewer_headers):
    viewer, _admin = viewer_headers
    assert client.post("/api/clients", json=_client_payload(), headers=viewer).status_code == 403


def test_viewer_cannot_delete_client(client, viewer_headers):
    viewer, admin = viewer_headers
    client_id = client.post("/api/clients", json=_client_payload(), headers=admin).json()["id"]
    assert client.delete(f"/api/clients/{client_id}", headers=viewer).status_code == 403


def test_viewer_cannot_change_settings(client, viewer_headers):
    viewer, _admin = viewer_headers
    assert client.put("/api/settings", json={"company_name": "Hijacked"}, headers=viewer).status_code == 403


def test_viewer_cannot_manage_users(client, viewer_headers):
    viewer, _admin = viewer_headers
    assert client.get("/api/users", headers=viewer).status_code == 403
