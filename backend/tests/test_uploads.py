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


def test_logo_upload_goes_through_storage_and_replaces_old(client, make_tenant, monkeypatch, tmp_path):
    """R-90: the endpoint writes via the StorageBackend and deletes the previous logo."""
    from app.api import settings as settings_api
    from app.services.storage import LocalStorage

    storage = LocalStorage(tmp_path)
    monkeypatch.setattr(settings_api, "get_storage", lambda: storage)
    t = make_tenant()

    first = client.post("/api/settings/logo", files={"file": ("a.png", io.BytesIO(_png()), "image/png")}, headers=t["headers"])
    assert first.status_code == 200, first.text
    first_key = storage.key_for_url(first.json()["logo_url"])
    assert first_key.startswith("logos/") and first_key.endswith(".png")
    assert storage.exists(first_key)

    second = client.post("/api/settings/logo", files={"file": ("b.png", io.BytesIO(_png()), "image/png")}, headers=t["headers"])
    assert second.status_code == 200, second.text
    assert not storage.exists(first_key)
    assert storage.exists(storage.key_for_url(second.json()["logo_url"]))
