from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]
    FRONTEND_URL: str = "http://localhost:5173"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Accept a comma-separated string as well as a JSON list.

        Exporting .env into the environment (`set -a; source .env`, most CI
        runners, systemd EnvironmentFile) strips the quotes from a JSON list
        and the app then dies at import. A plain comma-separated string
        survives every one of those. (R-36)
        """
        if isinstance(value, str):
            text = value.strip()
            if not text.startswith("["):
                return [origin.strip() for origin in text.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()