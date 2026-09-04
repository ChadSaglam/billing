import json
from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


def _parse_origins(raw: str) -> list[str]:
    """Accept a comma-separated string or a JSON list.

    A JSON list breaks whenever .env is exported into the environment
    (`set -a; source .env`, most CI runners, systemd EnvironmentFile),
    because the shell strips the quotes. Comma-separated survives all of
    them; the JSON form stays supported so existing .env files keep working.
    """
    text = (raw or "").strip()
    if not text:
        return []
    if text.startswith("["):
        return [str(origin).strip() for origin in json.loads(text)]
    return [origin.strip() for origin in text.split(",") if origin.strip()]


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Deliberately typed `str`, not `list[str]`.
    #
    # For a complex-typed field, pydantic-settings runs json.loads on the raw
    # environment value inside its own source, before any field validator
    # runs — so a validator cannot rescue a non-JSON value and the app dies at
    # import with JSONDecodeError. `Annotated[..., NoDecode]` fixes that but
    # only exists in newer pydantic-settings, which turns a config detail into
    # a version floor. Keeping the field a plain string sidesteps the decoder
    # entirely and works on every version; `allowed_origins` below is the
    # parsed value callers should use. (R-36)
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    FRONTEND_URL: str = "http://localhost:5173"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""

    @cached_property
    def allowed_origins(self) -> list[str]:
        """CORS origins as a list. Use this, not the raw ALLOWED_ORIGINS."""
        return _parse_origins(self.ALLOWED_ORIGINS)

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
