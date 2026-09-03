"""Shared pytest fixtures.

Uses TEST_DATABASE_URL (falls back to DATABASE_URL). Tables are created once
per session and every test runs inside a rolled-back transaction, so the
suite never leaves rows behind.
"""
import os
import pathlib
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_ROOT = pathlib.Path(__file__).resolve().parents[2]


def _load_dotenv(path: pathlib.Path) -> None:
    """Minimal .env loader so `pytest` works with no extra ceremony locally."""
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv(_ROOT / ".env")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_DB_URL = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")


@pytest.fixture(scope="session")
def engine():
    if not TEST_DB_URL:
        pytest.skip("TEST_DATABASE_URL / DATABASE_URL not set")
    eng = create_engine(TEST_DB_URL)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    connection = engine.connect()
    transaction = connection.begin()
    # join_transaction_mode="create_savepoint" makes the endpoint's own
    # db.commit() land on a SAVEPOINT, so the outer rollback below always
    # wins and the test never writes to your real database.
    session = sessionmaker(
        bind=connection,
        autocommit=False,
        autoflush=False,
        join_transaction_mode="create_savepoint",
    )()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(autouse=True)
def disable_rate_limiter():
    """The real /api/auth/register limit is 5/min. The suite registers far more
    tenants than that, so the limiter is switched off for the whole run — use
    the `rate_limiter_enabled` fixture in a test that asserts on the limit."""
    limiter = getattr(app.state, "limiter", None)
    if limiter is None:
        yield
        return
    previous = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = previous


@pytest.fixture
def rate_limiter_enabled():
    """Opt back in to real rate limiting inside a single test."""
    limiter = app.state.limiter
    previous = limiter.enabled
    limiter.enabled = True
    yield limiter
    limiter.enabled = previous


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:  # noqa: SIM117
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def make_tenant(client):
    """Register a fresh tenant+admin and return its auth headers."""

    def _make(role_suffix: str = ""):
        slug = uuid.uuid4().hex[:12]
        payload = {
            "email": f"{slug}@example.com",
            "password": "Sup3rSecret!pw",
            "full_name": f"Owner {slug}",
            "company_name": f"Test AG {slug}{role_suffix}",
        }
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 201, resp.text
        token = resp.json()["access_token"]
        return {
            "headers": {"Authorization": f"Bearer {token}"},
            "credentials": payload,
            "slug": slug,
        }

    return _make
