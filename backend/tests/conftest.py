"""Test fixtures.

The models use PostgreSQL-specific types (JSONB), so DB tests need a real
Postgres. Point TEST_DATABASE_URL at a throwaway database — CI provides one,
locally `docker compose up -d db` is enough. Tests that do not touch the
database run anywhere.

Every DB test runs inside a transaction that is rolled back afterwards, so
tests never see each other's rows.
"""

import os

# Must be set before anything imports app.config.
os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql://billing:billing@localhost:9202/billing_test",
)
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-to-pass-validation"
os.environ["APP_ENV"] = "test"

import pytest  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]


def _postgres_available() -> bool:
    try:
        eng = create_engine(TEST_DATABASE_URL, connect_args={"connect_timeout": 3})
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


POSTGRES_UP = _postgres_available()


def pytest_collection_modifyitems(config, items):
    """Skip @pytest.mark.db tests when there is no database.

    Done here rather than exporting a decorator, because `from tests.conftest
    import ...` only works if tests/ happens to be importable as a package —
    it is not, and pytest never guarantees it.
    """
    if POSTGRES_UP:
        return
    skip = pytest.mark.skip(
        reason=f"No PostgreSQL at {TEST_DATABASE_URL} — run `docker compose up -d db`"
    )
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


def _load_app():
    """Import the FastAPI app lazily.

    Kept out of module scope so that tests which need neither the app nor its
    heavy dependencies (WeasyPrint and friends) still collect and run.
    """
    from app.database import Base, get_db
    from app.main import app
    from app.rate_limit import limiter

    # Rate limits are per-IP; every test comes from the same IP.
    limiter.enabled = False
    return app, Base, get_db


@pytest.fixture(scope="session")
def app_bundle():
    if not POSTGRES_UP:
        pytest.skip("no database")
    return _load_app()


@pytest.fixture(scope="session")
def engine(app_bundle):
    _app, Base, _get_db = app_bundle
    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine):
    """A session wrapped in a transaction that is always rolled back."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(app_bundle, db):
    """TestClient sharing the test's rolled-back session."""
    from fastapi.testclient import TestClient

    app, _Base, get_db = app_bundle

    def _get_db_override():
        yield db

    app.dependency_overrides[get_db] = _get_db_override
    # No `with` on purpose: that would run the lifespan, whose startup jobs
    # commit on their own session and leak out of the test transaction.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_workspace(client):
    """Register a workspace and return its auth headers + credentials."""
    counter = {"n": 0}

    def _make(company: str | None = None):
        counter["n"] += 1
        n = counter["n"]
        company = company or f"Test Company {n}"
        email = f"owner{n}@billing-tests.com"
        password = "correct-horse-battery-staple"  # noqa: S105
        resp = client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": f"Owner {n}",
                "company_name": company,
            },
        )
        assert resp.status_code == 201, resp.text
        token = resp.json()["access_token"]
        return {
            "headers": {"Authorization": f"Bearer {token}"},
            "email": email,
            "password": password,
            "company": company,
        }

    return _make
