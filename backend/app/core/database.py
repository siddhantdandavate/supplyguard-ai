import logging
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

logger = logging.getLogger("supplyguard.database")
BACKEND_DIR = Path(__file__).resolve().parents[2]


def _resolve_sqlite_url(url: str) -> str:
    if url.startswith("sqlite:///./"):
        rel_name = url.replace("sqlite:///./", "")
        target = BACKEND_DIR / rel_name
        return f"sqlite:///{target.as_posix()}"
    return url


def create_app_engine():
    """PostgreSQL when reachable; otherwise SQLite for local development."""
    db_url = _resolve_sqlite_url(settings.DATABASE_URL)
    try:
        if db_url.startswith("postgres://"):
            # Some hosts (Heroku-style) hand out the legacy scheme.
            db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

        if db_url.startswith("postgresql"):
            engine = create_engine(
                db_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_recycle=1800,
                connect_args={"connect_timeout": 5},
            )
            with engine.connect():
                pass
            logger.info("Connected to PostgreSQL.")
            return engine
        if db_url.startswith("sqlite"):
            logger.info("Using SQLite database at %s", db_url)
            return create_engine(db_url, connect_args={"check_same_thread": False})
    except Exception as e:  # pragma: no cover - depends on environment
        if settings.is_production and not settings.ALLOW_SQLITE_FALLBACK:
            raise RuntimeError(f"Could not connect to the production database: {e}") from e
        logger.warning("Could not connect to PostgreSQL (%s). Falling back to SQLite for local development.", e.__class__.__name__)

    sqlite_url = _resolve_sqlite_url(settings.SQLITE_FALLBACK_URL)
    logger.info("Using SQLite database engine at %s", sqlite_url)
    return create_engine(sqlite_url, connect_args={"check_same_thread": False})


engine = create_app_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
