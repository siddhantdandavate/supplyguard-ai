import json
from dataclasses import asdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_planner_or_admin
from app.core.database import get_db
from app.models.disruption import RecoveryDecision, ShipmentDelay
from app.models.inventory import Inventory
from app.models.material import Material
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.dashboard import DisruptionSummary
from app.schemas.decision import DecisionCreate, DecisionResponse, DisruptionCreate
from app.schemas.disruption import ShipmentDelayResponse
from app.schemas.inventory import InventoryResponse
from app.schemas.scenario import OrderOutcomeOut, StrategyOutcomeOut
from app.services import engine

router = APIRouter(prefix="/disruptions", tags=["Disruptions"], dependencies=[Depends(require_planner_or_admin)])


def summarize(db: Session, delay: ShipmentDelay, with_recommendation: bool = False) -> DisruptionSummary:
    base = engine.baseline_impact(db, delay)
    rec_key = rec_cost = rec_avoided = None
    if with_recommendation:
        analysis = engine.analyze(db, delay)
        rec = next(s for s in analysis.strategies if s.recommended)
        rec_key, rec_cost, rec_avoided = rec.name, rec.added_cost, rec.penalties_avoided
    adopted = next((d for d in delay.decisions if d.status == "adopted"), None)
    return DisruptionSummary(
        id=delay.id,
        po_number=delay.po_number,
        supplier_name=delay.supplier.name if delay.supplier else "",
        material_sku=delay.material.sku if delay.material else "",
        material_name=delay.material.name if delay.material else "",
        quantity_delayed=delay.quantity_delayed,
        original_eta=delay.original_eta.isoformat(),
        revised_eta=delay.revised_eta.isoformat(),
        delay_days=delay.delay_days,
        status=delay.status,
        impact_severity=delay.impact_severity,
        reason=delay.reason,
        reported_at=delay.reported_at.isoformat(),
        updated_at=delay.updated_at.isoformat() if getattr(delay, "updated_at", None) else delay.reported_at.isoformat(),
        last_updated_by_role=getattr(delay, "last_updated_by_role", None),
        last_update_reason=delay.reason,
        affected_orders_count=base.affected_orders_count,
        late_orders_count=base.late_orders_count,
        shortage_units=base.shortage_units_immediate,
        sla_penalty_exposure=base.remaining_sla_penalties,
        revenue_at_risk=base.revenue_at_risk,
        customers_at_risk=base.customers_at_risk,
        recommended_strategy=rec_key,
        recommended_cost=rec_cost,
        recommended_penalties_avoided=rec_avoided,
        adopted_strategy=adopted.strategy_name if adopted else None,
    )


def decision_out(d: RecoveryDecision) -> DecisionResponse:
    try:
        assumptions = json.loads(d.assumptions_json or "{}")
    except ValueError:
        assumptions = {}
    return DecisionResponse(
        id=d.id,
        shipment_delay_id=d.shipment_delay_id,
        po_number=d.shipment_delay.po_number if d.shipment_delay else "",
        material_name=d.shipment_delay.material.name if d.shipment_delay and d.shipment_delay.material else "",
        strategy_key=d.strategy_key,
        strategy_name=d.strategy_name,
        simulated_delay_days=d.simulated_delay_days,
        assumptions=assumptions,
        added_cost=d.added_cost,
        remaining_delay_days=d.remaining_delay_days,
        late_orders_count=d.late_orders_count,
        protected_commitments=d.protected_commitments,
        remaining_sla_penalties=d.remaining_sla_penalties,
        penalties_avoided=d.penalties_avoided,
        net_benefit=d.net_benefit,
        revenue_protected=d.revenue_protected,
        summary=d.summary,
        note=d.note,
        status=d.status,
        decided_at=d.decided_at,
        decided_by_name=d.decided_by.full_name if d.decided_by else None,
    )


def classify_severity(base: engine.StrategyOutcome) -> str:
    """Severity derived from computed impact, not typed by hand."""
    if base.late_orders_count == 0:
        return "medium"
    tier1_late = any(o.is_late and o.customer_tier.startswith("Tier 1") for o in base.orders)
    if tier1_late or base.remaining_sla_penalties >= 10000 or base.late_orders_count >= 3:
        return "critical"
    return "high"


class DisruptionDetail(BaseModel):
    disruption: ShipmentDelayResponse
    summary: DisruptionSummary
    inventory: Optional[InventoryResponse]
    baseline: StrategyOutcomeOut
    affected_orders: List[OrderOutcomeOut]
    recommended: StrategyOutcomeOut
    scenario_summary: str
    decisions: List[DecisionResponse]


@router.get("", response_model=List[DisruptionSummary])
def list_disruptions(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Supplier shipment disruptions with their computed baseline impact."""
    q = db.query(ShipmentDelay)
    if status_filter:
        q = q.filter(ShipmentDelay.status == status_filter)
    if severity:
        q = q.filter(ShipmentDelay.impact_severity == severity)
    delays = q.order_by(ShipmentDelay.reported_at.desc()).all()
    return [summarize(db, d) for d in delays]


@router.post("", response_model=DisruptionSummary, status_code=status.HTTP_201_CREATED)
def report_disruption(payload: DisruptionCreate, db: Session = Depends(get_db)):
    """Report a new supplier shipment delay. Severity is computed from its impact."""
    po_number = payload.po_number.strip().upper()
    if db.query(ShipmentDelay).filter(ShipmentDelay.po_number == po_number).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A disruption for {po_number} already exists.")
    if not db.query(Supplier).filter(Supplier.id == payload.supplier_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown supplier.")
    if not db.query(Material).filter(Material.id == payload.material_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown material.")
    delay = ShipmentDelay(
        po_number=po_number,
        supplier_id=payload.supplier_id,
        material_id=payload.material_id,
        quantity_delayed=payload.quantity_delayed,
        original_eta=payload.original_eta,
        revised_eta=payload.revised_eta,
        delay_days=(payload.revised_eta - payload.original_eta).days,
        reason=(payload.reason or "").strip() or None,
        status="active",
        impact_severity="medium",
    )
    db.add(delay)
    db.flush()
    delay.impact_severity = classify_severity(engine.baseline_impact(db, delay))
    db.commit()
    db.refresh(delay)
    return summarize(db, delay, with_recommendation=True)


@router.get("/decisions", response_model=List[DecisionResponse])
def list_all_decisions(limit: int = 20, db: Session = Depends(get_db)):
    """Decision log across all disruptions, newest first."""
    rows = db.query(RecoveryDecision).order_by(RecoveryDecision.decided_at.desc()).limit(limit).all()
    return [decision_out(d) for d in rows]


@router.get("/delays", response_model=List[ShipmentDelayResponse])
def list_shipment_delays(db: Session = Depends(get_db)):
    """Raw shipment delay records (kept for compatibility)."""
    return db.query(ShipmentDelay).order_by(ShipmentDelay.reported_at.desc()).all()


@router.get("/delays/{delay_id}", response_model=ShipmentDelayResponse)
def get_shipment_delay(delay_id: int, db: Session = Depends(get_db)):
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")
    return delay


@router.get("/{delay_id}", response_model=DisruptionDetail)
def get_disruption_detail(delay_id: int, db: Session = Depends(get_db)):
    """Full impact view: shipment, inventory, shortages, affected orders, commitments at risk, decisions."""
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")
    analysis = engine.analyze(db, delay)
    baseline = next(s for s in analysis.strategies if s.key == "baseline")
    recommended = next(s for s in analysis.strategies if s.recommended)
    inv = db.query(Inventory).filter(Inventory.material_id == delay.material_id).first()
    return DisruptionDetail(
        disruption=ShipmentDelayResponse.model_validate(delay),
        summary=summarize(db, delay),
        inventory=InventoryResponse.model_validate(inv) if inv else None,
        baseline=StrategyOutcomeOut(**asdict(baseline)),
        affected_orders=[OrderOutcomeOut(**asdict(o)) for o in baseline.orders if o.unfilled_before > 0],
        recommended=StrategyOutcomeOut(**asdict(recommended)),
        scenario_summary=analysis.summary,
        decisions=[decision_out(d) for d in delay.decisions],
    )


class StatusUpdate(BaseModel):
    status: str


@router.patch("/{delay_id}/status", response_model=ShipmentDelayResponse)
def update_status(delay_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    """Mark a disruption active, mitigated or resolved."""
    if payload.status not in ("active", "mitigated", "resolved"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be active, mitigated or resolved.")
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")
    delay.status = payload.status
    db.commit()
    db.refresh(delay)
    return delay


@router.get("/{delay_id}/decisions", response_model=List[DecisionResponse])
def list_decisions(delay_id: int, db: Session = Depends(get_db)):
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")
    return [decision_out(d) for d in delay.decisions]


@router.post("/{delay_id}/decisions", response_model=DecisionResponse, status_code=status.HTTP_201_CREATED)
def adopt_decision(
    delay_id: int,
    payload: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adopt a recovery plan: re-runs the engine with the given inputs and stores the resulting outcome."""
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")
    overrides = payload.assumptions.model_dump(exclude_none=True) if payload.assumptions else {}
    assumptions = engine.Assumptions(delay_days=payload.delay_days if payload.delay_days is not None else delay.delay_days, **overrides)
    analysis = engine.analyze(db, delay, assumptions)
    chosen = next(s for s in analysis.strategies if s.key == payload.strategy_key)

    for prev in delay.decisions:
        if prev.status == "adopted":
            prev.status = "superseded"

    decision = RecoveryDecision(
        shipment_delay_id=delay.id,
        decided_by_user_id=current_user.id,
        strategy_key=chosen.key,
        strategy_name=chosen.name,
        simulated_delay_days=analysis.simulated_delay_days,
        assumptions_json=json.dumps(analysis.assumptions),
        added_cost=chosen.added_cost,
        remaining_delay_days=chosen.remaining_delay_days,
        late_orders_count=chosen.late_orders_count,
        protected_commitments=chosen.protected_commitments,
        remaining_sla_penalties=chosen.remaining_sla_penalties,
        penalties_avoided=chosen.penalties_avoided,
        net_benefit=chosen.net_benefit,
        revenue_protected=chosen.revenue_protected,
        summary=chosen.explanation,
        note=(payload.note or "").strip() or None,
        status="adopted",
    )
    db.add(decision)
    if payload.mark_mitigated:
        delay.status = "mitigated" if chosen.key != "baseline" else delay.status
    db.commit()
    db.refresh(decision)
    return decision_out(decision)
