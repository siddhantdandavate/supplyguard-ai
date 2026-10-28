import logging
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic import BaseModel

# Load backend/.env if present (never committed; see .env.example)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("supplyguard.config")

DEV_SECRET = "supplyguard-dev-only-secret-change-me"


def _csv_env(name: str, default: List[str]) -> List[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class Settings(BaseModel):
    PROJECT_NAME: str = "SupplyGuard AI Backend"
    APP_VERSION: str = "1.1.0"
    API_V1_STR: str = "/api"

    # development | production
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()

    # Security & JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", DEV_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

    # Database: PostgreSQL primary, SQLite fallback for local development
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/supplyguard",
    )
    SQLITE_FALLBACK_URL: str = os.getenv("SQLITE_FALLBACK_URL", "sqlite:///./supplyguard.db")
    # In production a missing PostgreSQL is an error unless explicitly allowed.
    ALLOW_SQLITE_FALLBACK: bool = _bool_env("ALLOW_SQLITE_FALLBACK", True)

    # Demo data
    SEED_DEMO_DATA: bool = _bool_env("SEED_DEMO_DATA", True)
    RESET_DEMO_DATA: bool = _bool_env("RESET_DEMO_DATA", False)

    # API docs (/docs, /redoc) — on in development, opt-in in production
    ENABLE_DOCS: bool = _bool_env("ENABLE_DOCS", os.getenv("ENVIRONMENT", "development").strip().lower() != "production")

    # CORS
    CORS_ORIGINS: List[str] = _csv_env(
        "CORS_ORIGINS",
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    def validate_for_runtime(self) -> None:
        """Fail fast on unsafe production configuration."""
        if not self.is_production:
            if self.SECRET_KEY == DEV_SECRET:
                logger.warning("Using the built-in development SECRET_KEY. Set SECRET_KEY before deploying.")
            return
        problems = []
        if self.SECRET_KEY == DEV_SECRET or len(self.SECRET_KEY) < 32:
            problems.append("SECRET_KEY must be set to a random value of at least 32 characters.")
        if not os.getenv("CORS_ORIGINS"):
            problems.append("CORS_ORIGINS must list the deployed frontend origin(s), e.g. https://your-site.netlify.app.")
        if problems:
            raise RuntimeError("Refusing to start in production: " + " ".join(problems))


settings = Settings()
