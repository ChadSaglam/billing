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
