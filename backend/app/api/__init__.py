from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.system import router as system_router
from app.api.dashboard import router as dashboard_router
from app.api.disruptions import router as disruptions_router
from app.api.scenarios import router as scenarios_router
from app.api.orders import router as orders_router
from app.api.suppliers import router as suppliers_router
from app.api.materials import router as materials_router
from app.api.inventory import router as inventory_router
from app.api.customers import router as customers_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(auth_router)
api_router.include_router(system_router)
api_router.include_router(dashboard_router)
api_router.include_router(disruptions_router)
api_router.include_router(scenarios_router)
api_router.include_router(orders_router)
api_router.include_router(suppliers_router)
api_router.include_router(materials_router)
api_router.include_router(inventory_router)
api_router.include_router(customers_router)
