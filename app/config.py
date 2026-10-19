from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Any SQLAlchemy URL works here -- swapping SQLite for PostgreSQL is a
    # one-line change in .env, nothing in the code needs to move.
    database_url: str = "sqlite:///./crm.db"

    secret_key: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    project_name: str = "CRM API"

    # Browser origins allowed to call this API. Comma-separated so it stays
    # readable in a .env file. Defaults to the Vite dev server.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
