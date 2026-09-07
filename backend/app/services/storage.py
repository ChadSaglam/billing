"""Where uploaded files (today: tenant logos) live (roadmap 4.4).

Local disk breaks as soon as there is more than one replica, so the upload
endpoint talks to a `StorageBackend` and the deployment picks one via
STORAGE_BACKEND=local|s3. Keys are relative paths like "logos/<uuid>.png".
"""

from pathlib import Path
from typing import Protocol

from app.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
LOCAL_URL_PREFIX = "/uploads/"


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> str:
        """Store `data` under `key` and return the public URL."""

    def delete(self, key: str) -> None:
        """Remove `key`; missing keys are not an error."""

    def url_to_key(self, url: str) -> str | None:
        """Inverse of the URL returned by save(); None if the URL is not ours."""


class LocalStorage:
    """Files under UPLOADS_DIR, served by the StaticFiles mount in main.py."""

    def __init__(self, root: Path = UPLOADS_DIR):
        self.root = root

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        # Keys are generated server-side, but a stray ".." must never escape.
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError(f"key escapes storage root: {key!r}")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{LOCAL_URL_PREFIX}{key}"

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink(missing_ok=True)

    def url_to_key(self, url: str) -> str | None:
        if not url.startswith(LOCAL_URL_PREFIX):
            return None
        return url[len(LOCAL_URL_PREFIX) :] or None


class S3Storage:
    """Any S3-compatible bucket (AWS, MinIO, R2). Credentials come from the
    standard AWS_* environment variables via boto3's default chain."""

    def __init__(self, bucket: str, endpoint_url: str = "", public_base_url: str = ""):
        if not bucket:
            raise ValueError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        # Lazy so boto3 stays an optional extra: local deployments never
        # import it and it is not in requirements.txt.
        import boto3

        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint_url or None)
        base = public_base_url or (
            f"{endpoint_url.rstrip('/')}/{bucket}" if endpoint_url else f"https://{bucket}.s3.amazonaws.com"
        )
        self.public_base_url = base.rstrip("/")

    def save(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return f"{self.public_base_url}/{key}"

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def url_to_key(self, url: str) -> str | None:
        prefix = f"{self.public_base_url}/"
        if not url.startswith(prefix):
            return None
        return url[len(prefix) :] or None


def get_storage() -> StorageBackend:
    """FastAPI dependency; override it in tests to point at a tmp dir."""
    backend = settings.STORAGE_BACKEND.lower()
    if backend == "local":
        return LocalStorage()
    if backend == "s3":
        return S3Storage(settings.S3_BUCKET, settings.S3_ENDPOINT_URL, settings.S3_PUBLIC_BASE_URL)
    raise ValueError(f"Unknown STORAGE_BACKEND {settings.STORAGE_BACKEND!r} (expected local or s3)")
