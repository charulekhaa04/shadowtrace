"""
SHADOWTRACE - Application Configuration
Pydantic Settings for environment variable management.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Security
    SECRET_KEY: str = "CHANGE-ME-to-a-long-random-string-at-least-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "sqlite:///./shadowtrace.db"

    # External API Keys
    VIRUSTOTAL_API_KEY: str = ""
    ABUSEIPDB_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # File paths
    UPLOAD_DIR: str = "./uploads"
    MODEL_DIR: str = "./data/models"
    CHROMA_DIR: str = "./data/chroma"

    # Dataset paths
    CIC_IDS_PATH: str = r"C:\Users\charu\CIC-IDS2017"
    SMAH_CTI_PATH: str = r"C:\Users\charu\Downloads\SMAH-CTI-extracted\SMAH-CTI-main\data\SMAH-CTI.json"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    # App metadata
    APP_NAME: str = "SHADOWTRACE"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()
