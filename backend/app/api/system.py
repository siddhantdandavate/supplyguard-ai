from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import engine

router = APIRouter(prefix="/system", tags=["System"])


class SystemInfo(BaseModel):
    app_name: str
    version: str
    api_prefix: str
    database_dialect: str
    database_target: str
    using_sqlite_fallback: bool
    demo_data: bool
    auth: str
    token_lifetime_minutes: int


@router.get("/info", response_model=SystemInfo, dependencies=[Depends(get_current_user)])
def system_info():
    """Non-secret runtime information for the Settings page."""
    url = engine.url
    target = url.database or ""
    if url.host:
        target = f"{url.host}:{url.port or ''}/{url.database}"
    return SystemInfo(
        app_name=settings.PROJECT_NAME,
        version=settings.APP_VERSION,
        api_prefix=settings.API_V1_STR,
        database_dialect=url.get_backend_name(),
        database_target=target,
        using_sqlite_fallback=url.get_backend_name() == "sqlite",
        demo_data=settings.SEED_DEMO_DATA,
        auth="JWT bearer (HS256), bcrypt password hashing",
        token_lifetime_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
