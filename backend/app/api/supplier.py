from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_supplier, get_supplier_for_user
from app.core.database import get_db
from app.models.disruption import ShipmentDelay, ShipmentUpdateHistory
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.disruption import ShipmentDelayResponse, ShipmentUpdateHistoryResponse, SupplierShipmentUpdate
from app.schemas.supplier import SupplierResponse
from app.services import engine

router = APIRouter(prefix="/supplier", tags=["Supplier Portal"], dependencies=[Depends(require_supplier)])


def _format_history(entry: ShipmentUpdateHistory) -> ShipmentUpdateHistoryResponse:
    return ShipmentUpdateHistoryResponse(
        id=entry.id,
        shipment_delay_id=entry.shipment_delay_id,
        updated_by_user_id=entry.updated_by_user_id,
        updated_by_name=entry.updated_by.full_name if entry.updated_by else None,
        previous_status=entry.previous_status,
        new_status=entry.new_status,
        previous_revised_eta=entry.previous_revised_eta,
        new_revised_eta=entry.new_revised_eta,
        previous_quantity_delayed=entry.previous_quantity_delayed,
        new_quantity_delayed=entry.new_quantity_delayed,
        delay_reason=entry.delay_reason,
        note=entry.note,
        updated_at=entry.updated_at,
    )


def _format_shipment(delay: ShipmentDelay) -> ShipmentDelayResponse:
    res = ShipmentDelayResponse.model_validate(delay)
    if delay.update_history:
        res.update_history = [_format_history(h) for h in delay.update_history]
    return res


def _classify_severity(base: engine.StrategyOutcome) -> str:
    """Severity derived from computed impact."""
    if base.late_orders_count == 0:
        return "medium"
    tier1_late = any(o.is_late and o.customer_tier.startswith("Tier 1") for o in base.orders)
    if tier1_late or base.remaining_sla_penalties >= 10000 or base.late_orders_count >= 3:
        return "critical"
    return "high"


@router.get("/profile", response_model=SupplierResponse)
def get_supplier_profile(
    current_user: User = Depends(require_supplier),
    db: Session = Depends(get_db),
):
    """Profile of the authenticated supplier organization."""
    sup = get_supplier_for_user(current_user, db)
    if not sup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No supplier organization is linked to this account.",
        )
    return SupplierResponse.model_validate(sup)


@router.get("/shipments", response_model=List[ShipmentDelayResponse])
def list_supplier_shipments(
    current_user: User = Depends(require_supplier),
    db: Session = Depends(get_db),
):
    """List ONLY shipments assigned to the logged-in supplier."""
    sup = get_supplier_for_user(current_user, db)
    if not sup:
        return []

    delays = (
        db.query(ShipmentDelay)
        .filter(ShipmentDelay.supplier_id == sup.id)
        .order_by(ShipmentDelay.reported_at.desc())
        .all()
    )
    return [_format_shipment(d) for d in delays]


@router.get("/shipments/{delay_id}", response_model=ShipmentDelayResponse)
def get_supplier_shipment(
    delay_id: int,
    current_user: User = Depends(require_supplier),
    db: Session = Depends(get_db),
):
    """Get a specific shipment assigned to the logged-in supplier."""
    sup = get_supplier_for_user(current_user, db)
    if not sup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier organization not found")

    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    if delay.supplier_id != sup.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this shipment record")

    return _format_shipment(delay)


@router.patch("/shipments/{delay_id}", response_model=ShipmentDelayResponse)
def update_supplier_shipment(
    delay_id: int,
    payload: SupplierShipmentUpdate,
    current_user: User = Depends(require_supplier),
    db: Session = Depends(get_db),
):
    """Update shipment status, revised ETA, delay reason, and affected quantity."""
    sup = get_supplier_for_user(current_user, db)
    if not sup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier organization not found")

    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")

    if delay.supplier_id != sup.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this shipment record")

    # Record previous values
    prev_status = delay.status
    prev_eta = delay.revised_eta
    prev_qty = delay.quantity_delayed

    # Apply updates
    if payload.status:
        valid_statuses = ("active", "mitigated", "resolved", "in_transit", "delayed", "customs_hold", "delivered")
        status_val = payload.status.strip().lower()
        if status_val not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Status must be one of: {', '.join(valid_statuses)}",
            )
        delay.status = status_val

    if payload.revised_eta:
        delay.revised_eta = payload.revised_eta
        # Delay days relative to original ETA
        delay.delay_days = max(0, (payload.revised_eta - delay.original_eta).days)

    if payload.quantity_delayed is not None:
        if payload.quantity_delayed < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity cannot be negative")
        delay.quantity_delayed = payload.quantity_delayed

    if payload.reason is not None:
        delay.reason = payload.reason.strip() or None

    now = datetime.now(timezone.utc)
    delay.updated_at = now
    delay.last_updated_by_role = "supplier"

    # Create history entry
    history = ShipmentUpdateHistory(
        shipment_delay_id=delay.id,
        updated_by_user_id=current_user.id,
        previous_status=prev_status,
        new_status=delay.status,
        previous_revised_eta=prev_eta,
        new_revised_eta=delay.revised_eta,
        previous_quantity_delayed=prev_qty,
        new_quantity_delayed=delay.quantity_delayed,
        delay_reason=delay.reason,
        note=(payload.note or "").strip() or None,
        updated_at=now,
    )
    db.add(history)
    db.flush()

    # Recalculate disruption impact and severity using existing engine
    try:
        base_impact = engine.baseline_impact(db, delay)
        delay.impact_severity = _classify_severity(base_impact)
    except Exception:
        pass  # Preserve current severity if recalculation fails

    db.commit()
    db.refresh(delay)

    return _format_shipment(delay)

