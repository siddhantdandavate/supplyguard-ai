from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, get_db

router = APIRouter()


@router.get("/health")
def get_health(db: Session = Depends(get_db)):
    """Liveness + readiness: returns 503 when the database cannot be queried."""
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    body = {
        "status": "ok" if db_ok else "degraded",
        "database": engine.url.get_backend_name(),
        "database_ok": db_ok,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }
    return JSONResponse(status_code=200 if db_ok else 503, content=body)
