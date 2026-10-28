from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dashboard import order_risk_map, risk_level
from app.api.deps import require_planner_or_admin
from app.core.database import get_db
from app.models.disruption import ProductionOrder
from app.schemas.aggregates import ProductionOrderWithRisk
from app.schemas.disruption import ProductionOrderResponse

router = APIRouter(prefix="/orders", tags=["Production Orders"], dependencies=[Depends(require_planner_or_admin)])


def with_risk(o: ProductionOrder, risk: dict) -> ProductionOrderWithRisk:
    r = risk.get(o.id)
    base = ProductionOrderResponse.model_validate(o).model_dump()
    return ProductionOrderWithRisk(
        **base,
        risk_level=risk_level(o, r),
        late_days=r["late_days"] if r else 0,
        sla_penalty=r["sla_penalty"] if r else 0.0,
        projected_completion_date=r["projected_completion_date"] if r else o.planned_completion_date.isoformat(),
        blocking_disruption_id=r["disruption_id"] if r else None,
        blocking_po_number=r["po_number"] if r else None,
        blocking_material=r["material"] if r else None,
    )


@router.get("", response_model=List[ProductionOrderWithRisk])
def list_orders(db: Session = Depends(get_db)):
    """Production orders with BOM lines and computed schedule risk."""
    risk = order_risk_map(db)
    orders = db.query(ProductionOrder).order_by(ProductionOrder.committed_delivery_date.asc()).all()
    return [with_risk(o, risk) for o in orders]


@router.get("/{order_id}", response_model=ProductionOrderWithRisk)
def get_order(order_id: int, db: Session = Depends(get_db)):
    o = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")
    return with_risk(o, order_risk_map(db))


class OrderStatusUpdate(BaseModel):
    status: str


@router.patch("/{order_id}/status", response_model=ProductionOrderWithRisk)
def update_order_status(order_id: int, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    """Move a production order between scheduled, in_progress, delayed and completed."""
    if payload.status not in ("scheduled", "in_progress", "delayed", "completed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be scheduled, in_progress, delayed or completed.")
    o = db.query(ProductionOrder).filter(ProductionOrder.id == order_id).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")
    o.status = payload.status
    db.commit()
    db.refresh(o)
    return with_risk(o, order_risk_map(db))
