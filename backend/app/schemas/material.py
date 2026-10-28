from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.supplier import SupplierResponse


class MaterialBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str = "General"
    unit_of_measure: str = "PCS"
    unit_cost: float = 0.0
    supplier_id: Optional[int] = None
    alternate_supplier_id: Optional[int] = None
    standard_lead_time_days: int = 14
    safety_stock: int = 50


class MaterialCreate(MaterialBase):
    pass


class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    supplier: Optional[SupplierResponse] = None
    alternate_supplier: Optional[SupplierResponse] = None

    model_config = ConfigDict(from_attributes=True)
