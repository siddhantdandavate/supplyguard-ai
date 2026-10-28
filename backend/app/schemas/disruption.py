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


class ShipmentUpdateHistoryResponse(BaseModel):
    id: int
    shipment_delay_id: int
    updated_by_user_id: Optional[int] = None
    updated_by_name: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: str
    previous_revised_eta: Optional[date] = None
    new_revised_eta: date
    previous_quantity_delayed: Optional[int] = None
    new_quantity_delayed: int
    delay_reason: Optional[str] = None
    note: Optional[str] = None
    updated_at: datetime

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
    updated_at: Optional[datetime] = None
    last_updated_by_role: Optional[str] = None
    supplier: Optional[SupplierResponse] = None
    material: Optional[MaterialResponse] = None
    recovery_options: List[RecoveryOptionResponse] = []
    update_history: List[ShipmentUpdateHistoryResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SupplierShipmentUpdate(BaseModel):
    status: Optional[str] = None
    revised_eta: Optional[date] = None
    reason: Optional[str] = None
    quantity_delayed: Optional[int] = None
    note: Optional[str] = None
