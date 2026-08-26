"""Startup validation must fail loudly on an insecure config."""

import pytest

from app.config import Settings


def _settings(**overrides) -> Settings:
    base = {
        "SECRET_KEY": "x" * 40,
        "DATABASE_URL": "postgresql://u:p@localhost:9202/billing",
        "APP_ENV": "development",
    }
    base.update(overrides)
    return Settings(**base)


def test_valid_config_passes():
    _settings().validate_runtime()


@pytest.mark.parametrize("bad", ["", "changeme", "short"])
def test_placeholder_or_short_secret_key_is_rejected(bad):
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        _settings(SECRET_KEY=bad).validate_runtime()


def test_missing_database_url_is_rejected():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        _settings(DATABASE_URL="").validate_runtime()


def test_production_rejects_wildcard_cors():
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        _settings(APP_ENV="production", ALLOWED_ORIGINS=["*"]).validate_runtime()


def test_production_rejects_localhost_cors():
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        _settings(
            APP_ENV="production", ALLOWED_ORIGINS=["http://localhost:9200"]
        ).validate_runtime()


def test_production_rejects_placeholder_db_password():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        _settings(
            APP_ENV="production",
            ALLOWED_ORIGINS=["https://app.example.com"],
            DATABASE_URL="postgresql://u:CHANGE_ME@db:5432/billing",
        ).validate_runtime()
