from datetime import date, datetime
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.scenario import ScenarioAssumptionsIn


class DecisionCreate(BaseModel):
    strategy_key: str = Field(..., pattern="^(baseline|expedite|alternate|reallocation|combined)$")
    delay_days: Optional[int] = Field(None, ge=0, le=180)
    assumptions: Optional[ScenarioAssumptionsIn] = None
    note: Optional[str] = Field(None, max_length=1000)
    mark_mitigated: bool = True


class DecisionResponse(BaseModel):
    id: int
    shipment_delay_id: int
    po_number: str
    material_name: str
    strategy_key: str
    strategy_name: str
    simulated_delay_days: int
    assumptions: Dict
    added_cost: float
    remaining_delay_days: int
    late_orders_count: int
    protected_commitments: int
    remaining_sla_penalties: float
    penalties_avoided: float
    net_benefit: float
    revenue_protected: float
    summary: Optional[str]
    note: Optional[str]
    status: str
    decided_at: datetime
    decided_by_name: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class DisruptionCreate(BaseModel):
    po_number: str = Field(..., min_length=2, max_length=50)
    supplier_id: int
    material_id: int
    quantity_delayed: int = Field(..., gt=0)
    original_eta: date
    revised_eta: date
    reason: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def _dates(self):
        if self.revised_eta < self.original_eta:
            raise ValueError("Revised ETA cannot be earlier than the original ETA.")
        return self
