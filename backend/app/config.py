from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://chadev:chadev@db:5432/chadev_billing"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
