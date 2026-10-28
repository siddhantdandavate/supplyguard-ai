from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, computed_field
from app.schemas.material import MaterialResponse


class InventoryBase(BaseModel):
    material_id: int
    current_stock: int = 0
    reserved_stock: int = 0
    reorder_point: int = 20
    location: str = "Main Warehouse"


class InventoryUpdate(BaseModel):
    current_stock: Optional[int] = None
    reserved_stock: Optional[int] = None
    reorder_point: Optional[int] = None
    location: Optional[str] = None


class InventoryResponse(InventoryBase):
    id: int
    available_stock: int
    updated_at: datetime
    material: Optional[MaterialResponse] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[misc]
    @property
    def stock_status(self) -> str:
        if self.available_stock <= 0:
            return "critical"
        if self.available_stock <= self.reorder_point:
            return "low"
        return "healthy"
