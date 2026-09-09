"""Pluggable file storage for uploads (R-90).

Default is the local `uploads/` directory served by the StaticFiles mount in
main.py — exactly today's behaviour. With more than one app replica the local
disk is not shared, so set STORAGE_BACKEND=s3 (any S3-compatible bucket).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> str:
        """Store `data` under `key` and return its public URL."""
        ...

    def delete(self, key: str) -> None: ...

    def exists(self, key: str) -> bool: ...

    def key_for_url(self, url: str) -> str | None:
        """Inverse of save(): the key behind a URL this backend issued, else None."""
        ...


class LocalStorage:
    def __init__(self, root: Path, public_prefix: str = "/uploads"):
        self.root = Path(root)
        self.public_prefix = public_prefix.rstrip("/")

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError(f"key escapes storage root: {key!r}")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.public_prefix}/{key}"

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def key_for_url(self, url: str) -> str | None:
        prefix = self.public_prefix + "/"
        if not url or not url.startswith(prefix):
            return None
        key = url[len(prefix) :]
        try:
            self._path(key)
        except ValueError:
            return None
        return key or None


class S3Storage:
    """Any S3-compatible bucket (AWS, MinIO, Hetzner, Cloudflare R2 ...).

    boto3 is imported on first use so the dependency is only needed when this
    backend is selected. `client` can be injected for tests.
    """

    def __init__(
        self,
        bucket: str,
        endpoint_url: str = "",
        access_key: str = "",
        secret_key: str = "",
        region: str = "",
        public_base_url: str = "",
        client=None,
    ):
        if not bucket:
            raise ValueError("S3_BUCKET is required for STORAGE_BACKEND=s3")
        self.bucket = bucket
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        base = public_base_url or (f"{endpoint_url.rstrip('/')}/{bucket}" if endpoint_url else f"https://{bucket}.s3.amazonaws.com")
        self.public_base_url = base.rstrip("/")
        self._client = client

    @property
    def client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url or None,
                aws_access_key_id=self.access_key or None,
                aws_secret_access_key=self.secret_key or None,
                region_name=self.region or None,
            )
        return self._client

    def save(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return f"{self.public_base_url}/{key}"

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
        except Exception:
            return False
        return True

    def key_for_url(self, url: str) -> str | None:
        prefix = self.public_base_url + "/"
        if not url or not url.startswith(prefix):
            return None
        return url[len(prefix) :] or None


@lru_cache(maxsize=1)
def get_storage() -> StorageBackend:
    backend = settings.STORAGE_BACKEND.lower()
    if backend == "local":
        return LocalStorage(UPLOADS_DIR)
    if backend == "s3":
        return S3Storage(
            bucket=settings.S3_BUCKET,
            endpoint_url=settings.S3_ENDPOINT_URL,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            region=settings.S3_REGION,
            public_base_url=settings.S3_PUBLIC_BASE_URL,
        )
    raise ValueError(f"Unknown STORAGE_BACKEND {settings.STORAGE_BACKEND!r} (expected 'local' or 's3')")
