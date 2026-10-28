from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioAssumptionsIn(BaseModel):
    """All fields optional; omitted values are derived from the data (see engine docstring)."""

    expedite_days_saved: Optional[int] = Field(None, ge=0, le=120)
    expedite_fixed_cost: Optional[float] = Field(None, ge=0)
    expedite_cost_per_unit: Optional[float] = Field(None, ge=0)
    alternate_lead_time_days: Optional[int] = Field(None, ge=0, le=180)
    alternate_price_premium_pct: Optional[float] = Field(None, ge=0, le=500)
    alternate_coverage_pct: Optional[float] = Field(None, ge=0, le=100)
    reallocation_handling_cost_per_unit: Optional[float] = Field(None, ge=0)


class ScenarioRequest(BaseModel):
    delay_id: int
    delay_days: Optional[int] = Field(None, ge=0, le=180, description="Simulated delay; defaults to the reported delay")
    assumptions: Optional[ScenarioAssumptionsIn] = None


class OrderOutcomeOut(BaseModel):
    order_id: int
    order_number: str
    product_name: str
    customer_id: Optional[int]
    customer_name: str
    customer_tier: str
    priority: str
    status: str
    quantity_required: int
    quantity_allocated: int
    unfilled_before: int
    unfilled_after_pool: int
    cover_date: Optional[str]
    planned_completion_date: str
    committed_delivery_date: str
    projected_completion_date: str
    late_days: int
    sla_penalty: float
    revenue_value: float
    is_late: bool
    role: str


class StrategyOutcomeOut(BaseModel):
    key: str
    name: str
    description: str
    added_cost: float
    remaining_delay_days: int
    days_saved: int
    supply_arrival_date: Optional[str]
    shortage_units_immediate: int
    shortage_units_remaining: int
    affected_orders_count: int
    late_orders_count: int
    protected_commitments: int
    customers_at_risk: int
    baseline_sla_penalties: float
    remaining_sla_penalties: float
    penalties_avoided: float
    revenue_at_risk: float
    revenue_protected: float
    total_exposure: float
    net_benefit: float
    units_reallocated: int
    units_from_alternate: int
    recommended: bool
    explanation: str
    risks: List[str]
    orders: List[OrderOutcomeOut]


class ScenarioResponse(BaseModel):
    delay_id: int
    po_number: str
    material_id: int
    material_sku: str
    material_name: str
    supplier_name: str
    original_eta: str
    revised_eta: str
    reported_delay_days: int
    simulated_delay_days: int
    free_stock: int
    total_unfilled_demand: int
    assumptions: Dict
    strategies: List[StrategyOutcomeOut]
    recommended_key: str
    summary: str


class StrategyInfo(BaseModel):
    key: str
    name: str
    short: str
    description: str
