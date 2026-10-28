from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.customer import CustomerResponse
from app.schemas.material import MaterialResponse
from app.schemas.supplier import SupplierResponse


class ProductionOrderMaterialResponse(BaseModel):
    id: int
    material_id: int
    quantity_required: int
    quantity_allocated: int
    material: Optional[MaterialResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProductionOrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    product_name: str
    quantity: int
    status: str
    planned_start_date: date
    planned_completion_date: date
    committed_delivery_date: date
    revenue_value: float
    priority: str
    customer: Optional[CustomerResponse] = None
    materials_required: List[ProductionOrderMaterialResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RecoveryOptionResponse(BaseModel):
    id: int
    shipment_delay_id: int
    strategy_name: str
    description: Optional[str] = None
    additional_cost: float
    days_saved: int
    net_delay_days: int
    sla_penalty_saved: float
    tradeoff_score: float
    recommended: int

    model_config = ConfigDict(from_attributes=True)


class ShipmentDelayResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    material_id: int
    quantity_delayed: int
    original_eta: date
    revised_eta: date
    delay_days: int
    reason: Optional[str] = None
    status: str
    impact_severity: str
    reported_at: datetime
    supplier: Optional[SupplierResponse] = None
    material: Optional[MaterialResponse] = None
    recovery_options: List[RecoveryOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)

