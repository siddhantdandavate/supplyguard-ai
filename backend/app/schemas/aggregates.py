"""Composite response schemas that combine several entities. Kept in one module to avoid import cycles."""
from typing import List, Optional

from app.schemas.customer import CustomerResponse
from app.schemas.disruption import ProductionOrderResponse, ShipmentDelayResponse
from app.schemas.material import MaterialResponse
from app.schemas.supplier import SupplierResponse


class ProductionOrderWithRisk(ProductionOrderResponse):
    risk_level: str
    late_days: int = 0
    sla_penalty: float = 0.0
    projected_completion_date: Optional[str] = None
    blocking_disruption_id: Optional[int] = None
    blocking_po_number: Optional[str] = None
    blocking_material: Optional[str] = None


class SupplierDetail(SupplierResponse):
    active_shipment_count: int = 0
    total_shipment_count: int = 0
    materials_supplied: int = 0
    shipments: List[ShipmentDelayResponse] = []
    materials: List[MaterialResponse] = []


class CustomerDetail(CustomerResponse):
    active_order_count: int = 0
    orders_at_risk: int = 0
    open_revenue: float = 0.0
    penalty_exposure: float = 0.0
    next_commitment_date: Optional[str] = None
    orders: List[ProductionOrderWithRisk] = []
