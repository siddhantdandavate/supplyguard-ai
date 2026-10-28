from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # noqa: F401  (register all models with Base before create_all)
from app.db.seed import seed_database, reset_database
from app.db.migrations import run_migrations

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("supplyguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_for_runtime()
    try:
        if settings.RESET_DEMO_DATA:
            logger.warning("RESET_DEMO_DATA is set: dropping and recreating all tables.")
            reset_database()
        logger.info("Initializing database schema...")
        Base.metadata.create_all(bind=engine)
        run_migrations()
        if settings.SEED_DEMO_DATA:
            seed_database()
    except Exception as e:  # pragma: no cover - startup diagnostics
        logger.error(f"Startup database initialization error: {e}")
        if settings.is_production:
            raise
    logger.info("SupplyGuard API %s ready (%s, db=%s)", settings.APP_VERSION, settings.ENVIRONMENT, engine.url.get_backend_name())
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SupplyGuard AI — Production Rescue Planner API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Response-Time-Ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. Check the backend log for details."})


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {
        "name": "SupplyGuard AI API",
        "version": settings.APP_VERSION,
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs" if settings.ENABLE_DOCS else None,
        "database": engine.url.get_backend_name(),
    }
