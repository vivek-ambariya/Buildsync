"""Application configuration, loaded from environment (.env) once at import."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "BuildSync AI"
    environment: str = "development"
    api_prefix: str = "/api"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "buildsync"

    jwt_secret: str = "insecure-development-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    storage_dir: str = "storage"

    llm_provider: str = ""
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_path(self) -> Path:
        path = BASE_DIR / self.storage_dir
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
