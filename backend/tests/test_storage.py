"""StorageBackend abstraction for uploads (R-90)."""

from app.services.storage import LocalStorage, S3Storage, get_storage


def test_local_storage_round_trip(tmp_path):
    storage = LocalStorage(tmp_path, public_prefix="/uploads")
    url = storage.save("logos/a.png", b"png-bytes", "image/png")
    assert url == "/uploads/logos/a.png"
    assert (tmp_path / "logos" / "a.png").read_bytes() == b"png-bytes"
    assert storage.exists("logos/a.png")
    assert storage.key_for_url(url) == "logos/a.png"
    assert storage.key_for_url("https://elsewhere.example/x.png") is None
    assert storage.key_for_url("/uploads/../etc/passwd") is None
    storage.delete("logos/a.png")
    assert not storage.exists("logos/a.png")
    storage.delete("logos/a.png")  # idempotent


def test_get_storage_defaults_to_local():
    get_storage.cache_clear()
    storage = get_storage()
    assert isinstance(storage, LocalStorage)
    assert storage.root.name == "uploads"
    assert get_storage() is storage  # cached


class FakeS3Client:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.calls: list[tuple] = []

    def put_object(self, Bucket, Key, Body, ContentType):  # noqa: N803
        self.calls.append(("put", Bucket, Key))
        self.objects[Key] = (Body, ContentType)

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.calls.append(("delete", Bucket, Key))
        self.objects.pop(Key, None)

    def head_object(self, Bucket, Key):  # noqa: N803
        if Key not in self.objects:
            raise Exception("404")  # noqa: TRY002
        return {}


def test_s3_storage_uses_injected_client():
    fake = FakeS3Client()
    storage = S3Storage(bucket="logos-bucket", public_base_url="https://cdn.example.com", client=fake)
    url = storage.save("logos/b.webp", b"webp", "image/webp")
    assert url == "https://cdn.example.com/logos/b.webp"
    assert fake.objects["logos/b.webp"] == (b"webp", "image/webp")
    assert storage.exists("logos/b.webp")
    assert storage.key_for_url(url) == "logos/b.webp"
    assert storage.key_for_url("/uploads/logos/b.webp") is None
    storage.delete("logos/b.webp")
    assert not storage.exists("logos/b.webp")
    assert ("delete", "logos-bucket", "logos/b.webp") in fake.calls


def test_s3_public_url_derived_from_endpoint():
    storage = S3Storage(bucket="b", endpoint_url="https://minio.local:9000/", client=object())
    assert storage.public_base_url == "https://minio.local:9000/b"
