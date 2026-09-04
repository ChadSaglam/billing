"""ALLOWED_ORIGINS must survive both spellings (R-36).

This is deliberately end-to-end through Settings rather than a unit test of
the parser: the bug it guards against lived in pydantic-settings' own value
decoding, upstream of anything the parser could see.
"""
import pytest

from app.config import Settings


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # The form any shell-exported .env produces.
        ("http://localhost:9200", ["http://localhost:9200"]),
        ("http://a.example, http://b.example", ["http://a.example", "http://b.example"]),
        # The JSON form, still accepted so existing .env files keep working.
        ('["http://localhost:9200"]', ["http://localhost:9200"]),
        ('["http://a.example", "http://b.example"]', ["http://a.example", "http://b.example"]),
        ("", []),
    ],
)
def test_allowed_origins_accepts_both_forms(monkeypatch, raw, expected):
    monkeypatch.setenv("ALLOWED_ORIGINS", raw)
    # _env_file=None so the repo's own .env cannot mask the variable.
    assert Settings(_env_file=None).allowed_origins == expected


def test_settings_import_does_not_require_json(monkeypatch):
    """The original crash: JSONDecodeError at import, before the app started."""
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:9200")
    settings = Settings(_env_file=None)
    assert settings.ALLOWED_ORIGINS == "http://localhost:9200"
    assert settings.allowed_origins == ["http://localhost:9200"]
