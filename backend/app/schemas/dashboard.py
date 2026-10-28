from typing import List, Optional
from pydantic import BaseModel

from app.schemas.decision import DecisionResponse


class DashboardMetrics(BaseModel):
    orders_at_risk: int
    orders_total: int
    critical_shortages: int
    low_stock_items: int
    delayed_shipments: int
    critical_shipments: int
    commitments_at_risk: int
    customers_total: int
    sla_penalty_exposure: float
    revenue_at_risk: float
    recoverable_penalties: float


class DisruptionSummary(BaseModel):
    id: int
    po_number: str
    supplier_name: str
    material_sku: str
    material_name: str
    quantity_delayed: int
    original_eta: str
    revised_eta: str
    delay_days: int
    status: str
    impact_severity: str
    reason: Optional[str]
    reported_at: str
    updated_at: Optional[str] = None
    last_updated_by_role: Optional[str] = None
    last_update_reason: Optional[str] = None
    affected_orders_count: int
    late_orders_count: int
    shortage_units: int
    sla_penalty_exposure: float
    revenue_at_risk: float
    customers_at_risk: int
    recommended_strategy: Optional[str] = None
    recommended_cost: Optional[float] = None
    recommended_penalties_avoided: Optional[float] = None
    adopted_strategy: Optional[str] = None


class CriticalOrderSummary(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_tier: str
    product_name: str
    quantity: int
    status: str
    priority: str
    committed_delivery_date: str
    projected_completion_date: str
    late_days: int
    sla_penalty: float
    revenue_value: float
    risk_level: str
    blocking_disruption_id: Optional[int] = None
    blocking_po_number: Optional[str] = None
    blocking_material: Optional[str] = None


class TimelineEvent(BaseModel):
    date: str
    kind: str  # original_eta | revised_eta | order_due | projected_completion | today
    label: str
    severity: str  # critical | high | medium | low | info
    disruption_id: Optional[int] = None
    order_id: Optional[int] = None


class NextAction(BaseModel):
    priority: int
    title: str
    detail: str
    route: str
    severity: str


class DashboardSummary(BaseModel):
    generated_at: str
    demo_data: bool
    metrics: DashboardMetrics
    disruptions: List[DisruptionSummary]
    critical_orders: List[CriticalOrderSummary]
    timeline: List[TimelineEvent]
    next_actions: List[NextAction]
    recent_decisions: List[DecisionResponse]
