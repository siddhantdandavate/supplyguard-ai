from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    tier: str = "Tier 2 - Preferred"
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    sla_penalty_per_day: float = Field(250.0, ge=0)
    priority_score: int = Field(50, ge=1, le=100)


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
