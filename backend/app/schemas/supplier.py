from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    lead_time_days: int = Field(14, ge=0, le=365)
    on_time_delivery_rate: float = Field(0.90, ge=0.0, le=1.0)
    reliability_score: float = Field(8.5, ge=0.0, le=10.0)


class SupplierCreate(SupplierBase):
    pass


class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
