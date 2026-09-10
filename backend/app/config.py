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
    # Python logging level name; logs are JSON lines on stdout (R-27).
    LOG_LEVEL: str = "INFO"
    # Empty = Sentry disabled (R-91).
    SENTRY_DSN: str = ""
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Self-serve signup defaults (R-11). Both already exist in .env but were
    # dropped by extra="ignore" — no model read them. Registration now does.
    DEFAULT_PLAN: str = "trial"
    TRIAL_DAYS: int = 14

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
    ALLOWED_ORIGINS: str = "http://localhost:5050"

    FRONTEND_URL: str = "http://localhost:5050"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""

    # Upload storage (R-90). "local" serves ./uploads via StaticFiles and only
    # works with a single replica; "s3" is any S3-compatible bucket.
    STORAGE_BACKEND: str = "local"
    S3_BUCKET: str = ""
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = ""
    S3_PUBLIC_BASE_URL: str = ""

    # Scheduled jobs (R-84). True = the API runs them in-process (single
    # container, local dev). Compose sets it false on the API and starts a
    # separate `python -m app.jobs` service instead.
    RUN_JOBS_IN_API: bool = True
    JOBS_INTERVAL_SECONDS: int = 3600

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
