"""Logo upload validation (R-09)."""
import io


def test_svg_logo_is_rejected(client, make_tenant):
    """SVG can carry <script> and is served from the app's own origin."""
    t = make_tenant()
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    resp = client.post(
        "/api/settings/logo",
        files={"file": ("logo.svg", io.BytesIO(svg), "image/svg+xml")},
        headers=t["headers"],
    )
    assert resp.status_code == 415


def test_non_image_disguised_as_png_is_rejected(client, make_tenant):
    t = make_tenant()
    resp = client.post(
        "/api/settings/logo",
        files={"file": ("payload.png", io.BytesIO(b"#!/bin/sh\nrm -rf /"), "image/png")},
        headers=t["headers"],
    )
    assert resp.status_code == 400


def test_oversized_logo_is_rejected(client, make_tenant):
    t = make_tenant()
    resp = client.post(
        "/api/settings/logo",
        files={"file": ("big.png", io.BytesIO(b"\x00" * (3 * 1024 * 1024)), "image/png")},
        headers=t["headers"],
    )
    assert resp.status_code == 413


def test_preview_rejects_token_in_query_string(client, make_tenant):
    """R-06: the JWT must not be accepted as a URL parameter any more."""
    t = make_tenant()
    token = t["headers"]["Authorization"].split()[1]
    assert client.get(f"/api/documents/1/preview?token={token}").status_code == 401


def _png() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2, 2), "white").save(buf, format="PNG")
    return buf.getvalue()


def test_valid_logo_is_stored_and_old_one_removed(client, make_tenant, tmp_path):
    """The endpoint goes through StorageBackend (4.4); the tmp dir keeps the
    real backend/uploads untouched."""
    from app.main import app
    from app.services.storage import LocalStorage, get_storage

    app.dependency_overrides[get_storage] = lambda: LocalStorage(tmp_path)
    t = make_tenant()

    first = client.post(
        "/api/settings/logo",
        files={"file": ("logo.png", io.BytesIO(_png()), "image/png")},
        headers=t["headers"],
    )
    assert first.status_code == 200, first.text
    first_url = first.json()["logo_url"]
    assert first_url.startswith("/uploads/logos/") and first_url.endswith(".png")
    assert (tmp_path / first_url.removeprefix("/uploads/")).is_file()

    second = client.post(
        "/api/settings/logo",
        files={"file": ("logo.png", io.BytesIO(_png()), "image/png")},
        headers=t["headers"],
    )
    assert second.status_code == 200, second.text
    assert not (tmp_path / first_url.removeprefix("/uploads/")).exists()
    assert (tmp_path / second.json()["logo_url"].removeprefix("/uploads/")).is_file()
