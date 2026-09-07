"""StorageBackend (4.4): LocalStorage on disk, S3Storage against a fake client."""

import sys
import types

import pytest

from app.services import storage as storage_mod
from app.services.storage import LocalStorage, S3Storage, get_storage


def test_local_save_returns_uploads_url_and_writes_file(tmp_path):
    s = LocalStorage(tmp_path)
    url = s.save("logos/a.png", b"png-bytes", "image/png")
    assert url == "/uploads/logos/a.png"
    assert (tmp_path / "logos" / "a.png").read_bytes() == b"png-bytes"
    assert s.url_to_key(url) == "logos/a.png"


def test_local_delete_removes_file_and_tolerates_missing(tmp_path):
    s = LocalStorage(tmp_path)
    s.save("logos/a.png", b"x", "image/png")
    s.delete("logos/a.png")
    assert not (tmp_path / "logos" / "a.png").exists()
    s.delete("logos/a.png")  # second call must not raise


def test_local_rejects_key_escaping_root(tmp_path):
    with pytest.raises(ValueError):
        LocalStorage(tmp_path).save("../outside.png", b"x", "image/png")


def test_local_url_to_key_ignores_foreign_urls(tmp_path):
    s = LocalStorage(tmp_path)
    assert s.url_to_key("https://cdn.example.com/logo.png") is None
    assert s.url_to_key("") is None


def test_s3_backend_uses_client_and_public_url(monkeypatch):
    calls = []

    class FakeClient:
        def put_object(self, **kw):
            calls.append(("put", kw))

        def delete_object(self, **kw):
            calls.append(("delete", kw))

    fake_boto3 = types.SimpleNamespace(client=lambda *a, **kw: FakeClient())
    monkeypatch.setitem(sys.modules, "boto3", fake_boto3)

    s = S3Storage("bucket", endpoint_url="http://minio:9000", public_base_url="https://cdn.example.com/")
    url = s.save("logos/a.png", b"x", "image/png")
    assert url == "https://cdn.example.com/logos/a.png"
    assert calls[0] == ("put", {"Bucket": "bucket", "Key": "logos/a.png", "Body": b"x", "ContentType": "image/png"})
    assert s.url_to_key(url) == "logos/a.png"
    assert s.url_to_key("/uploads/logos/a.png") is None
    s.delete("logos/a.png")
    assert calls[1] == ("delete", {"Bucket": "bucket", "Key": "logos/a.png"})


def test_get_storage_defaults_to_local(monkeypatch):
    monkeypatch.setattr(storage_mod.settings, "STORAGE_BACKEND", "local")
    assert isinstance(get_storage(), LocalStorage)


def test_get_storage_rejects_unknown_backend(monkeypatch):
    monkeypatch.setattr(storage_mod.settings, "STORAGE_BACKEND", "ftp")
    with pytest.raises(ValueError):
        get_storage()
