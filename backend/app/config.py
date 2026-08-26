from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"

# Anything in this set is a placeholder, not a real secret.
_PLACEHOLDER_SECRETS = {"", "changeme", "CHANGE_ME", "secret", "dev", "test"}


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Billing"
    APP_ENV: str = "development"  # development | staging | production

    # Database
    DATABASE_URL: str = ""

    # Auth
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # Ports / URLs — this project owns the 92xx block (see CLAUDE.md)
    FRONTEND_PORT: int = 9200
    BACKEND_PORT: int = 9201
    DB_PORT: int = 9202
    ALLOWED_ORIGINS: list[str] = ["http://localhost:9200"]
    FRONTEND_URL: str = "http://localhost:9200"

    # SaaS
    SIGNUP_ENABLED: bool = True
    DEFAULT_PLAN: str = "trial"
    TRIAL_DAYS: int = 14

    # Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"production", "prod", "staging"}

    def validate_runtime(self) -> None:
        """Fail fast on misconfiguration instead of booting insecurely."""
        problems: list[str] = []

        if self.SECRET_KEY.strip() in _PLACEHOLDER_SECRETS:
            problems.append(
                "SECRET_KEY is empty or a placeholder. "
                "Generate one with: openssl rand -hex 32"
            )
        elif len(self.SECRET_KEY) < 32:
            problems.append("SECRET_KEY must be at least 32 characters.")

        if not self.DATABASE_URL:
            problems.append("DATABASE_URL is not set.")

        if self.is_production:
            if "CHANGE_ME" in self.DATABASE_URL or "changeme" in self.DATABASE_URL:
                problems.append("DATABASE_URL still contains a placeholder password.")
            if any(o.strip() == "*" for o in self.ALLOWED_ORIGINS):
                problems.append("ALLOWED_ORIGINS must not be '*' in production.")
            if any("localhost" in o for o in self.ALLOWED_ORIGINS):
                problems.append("ALLOWED_ORIGINS still points at localhost in production.")

        if problems:
            raise RuntimeError(
                "Refusing to start — fix your .env:\n  - " + "\n  - ".join(problems)
            )


settings = Settings()
