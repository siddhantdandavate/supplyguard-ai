from datetime import date, datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.disruptions import decision_out, summarize
from app.core.config import settings
from app.core.database import get_db
from app.models.customer import Customer
from app.models.disruption import ProductionOrder, RecoveryDecision, ShipmentDelay
from app.models.inventory import Inventory
from app.schemas.dashboard import (
    CriticalOrderSummary,
    DashboardMetrics,
    DashboardSummary,
    NextAction,
    TimelineEvent,
)
from app.services import engine

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(get_current_user)])


def order_risk_map(db: Session) -> Dict[int, dict]:
    """For every open order, the worst baseline outcome across active disruptions."""
    risk: Dict[int, dict] = {}
    delays = db.query(ShipmentDelay).filter(ShipmentDelay.status == "active").all()
    for d in delays:
        base = engine.baseline_impact(db, d)
        for o in base.orders:
            if o.unfilled_before <= 0:
                continue
            current = risk.get(o.order_id)
            if current is None or o.late_days > current["late_days"]:
                risk[o.order_id] = {
                    "late_days": o.late_days,
                    "sla_penalty": o.sla_penalty,
                    "projected_completion_date": o.projected_completion_date,
                    "disruption_id": d.id,
                    "po_number": d.po_number,
                    "material": d.material.name if d.material else "",
                    "is_late": o.is_late,
                }
    return risk


def risk_level(order: ProductionOrder, r: dict | None) -> str:
    if r and r["is_late"]:
        return "critical" if (order.priority == "critical" or r["late_days"] >= 5) else "high"
    if order.status == "delayed":
        return "high"
    if r:
        return "medium"
    return "low"


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()
    delays = db.query(ShipmentDelay).order_by(ShipmentDelay.reported_at.desc()).all()
    active = [d for d in delays if d.status == "active"]
    orders = db.query(ProductionOrder).filter(ProductionOrder.status != "completed").all()
    inventory = db.query(Inventory).all()
    customers_total = db.query(Customer).count()

    summaries = [summarize(db, d, with_recommendation=(d.status == "active")) for d in delays]
    risk = order_risk_map(db)

    late_order_ids = {oid for oid, r in risk.items() if r["is_late"]}
    orders_at_risk = len(late_order_ids | {o.id for o in orders if o.status == "delayed"})
    # Worst case per order across active disruptions, so an order hit by two delays is not counted twice.
    order_by_id = {o.id: o for o in orders}
    penalty_exposure = sum(r["sla_penalty"] for r in risk.values() if r["is_late"])
    revenue_at_risk = sum(float(order_by_id[oid].revenue_value or 0.0) for oid, r in risk.items() if r["is_late"] and oid in order_by_id)
    recoverable = sum((s.recommended_penalties_avoided or 0.0) for s in summaries if s.status == "active")
    customers_at_risk = {o.customer_id for o in orders if o.id in late_order_ids and o.customer_id}

    critical_shortages = sum(1 for i in inventory if i.available_stock <= 0)
    low_stock = sum(1 for i in inventory if 0 < i.available_stock <= i.reorder_point)

    metrics = DashboardMetrics(
        orders_at_risk=orders_at_risk,
        orders_total=len(orders),
        critical_shortages=critical_shortages,
        low_stock_items=low_stock,
        delayed_shipments=len(active),
        critical_shipments=sum(1 for d in active if d.impact_severity == "critical"),
        commitments_at_risk=len(customers_at_risk),
        customers_total=customers_total,
        sla_penalty_exposure=round(penalty_exposure, 2),
        revenue_at_risk=round(revenue_at_risk, 2),
        recoverable_penalties=round(recoverable, 2),
    )

    critical_orders: List[CriticalOrderSummary] = []
    for o in orders:
        r = risk.get(o.id)
        level = risk_level(o, r)
        if level == "low":
            continue
        critical_orders.append(
            CriticalOrderSummary(
                id=o.id,
                order_number=o.order_number,
                customer_name=o.customer.name if o.customer else "",
                customer_tier=o.customer.tier if o.customer else "",
                product_name=o.product_name,
                quantity=o.quantity,
                status=o.status,
                priority=o.priority,
                committed_delivery_date=o.committed_delivery_date.isoformat(),
                projected_completion_date=(r["projected_completion_date"] if r else o.planned_completion_date.isoformat()),
                late_days=r["late_days"] if r else 0,
                sla_penalty=r["sla_penalty"] if r else 0.0,
                revenue_value=float(o.revenue_value or 0.0),
                risk_level=level,
                blocking_disruption_id=r["disruption_id"] if r else None,
                blocking_po_number=r["po_number"] if r else None,
                blocking_material=r["material"] if r else None,
            )
        )
    order_rank = {"critical": 0, "high": 1, "medium": 2}
    critical_orders.sort(key=lambda c: (order_rank[c.risk_level], -c.late_days, c.committed_delivery_date))

    timeline: List[TimelineEvent] = [TimelineEvent(date=today.isoformat(), kind="today", label="Today", severity="info")]
    sev_map = {"critical": "critical", "high": "high", "medium": "medium"}
    for d in active:
        timeline.append(TimelineEvent(date=d.original_eta.isoformat(), kind="original_eta", label=f"{d.po_number} original ETA", severity="low", disruption_id=d.id))
        timeline.append(TimelineEvent(date=d.revised_eta.isoformat(), kind="revised_eta", label=f"{d.po_number} revised ETA (+{d.delay_days}d)", severity=sev_map.get(d.impact_severity, "medium"), disruption_id=d.id))
    for c in critical_orders:
        timeline.append(TimelineEvent(date=c.committed_delivery_date, kind="order_due", label=f"{c.order_number} due ({c.customer_name})", severity="high" if c.late_days > 0 else "medium", order_id=c.id))
        if c.late_days > 0:
            timeline.append(TimelineEvent(date=c.projected_completion_date, kind="projected_completion", label=f"{c.order_number} projected finish ({c.late_days}d late)", severity="critical", order_id=c.id))
    timeline.sort(key=lambda e: e.date)

    actions: List[NextAction] = []
    for s in sorted([s for s in summaries if s.status == "active"], key=lambda s: -s.sla_penalty_exposure):
        if s.late_orders_count > 0:
            actions.append(NextAction(
                priority=len(actions) + 1,
                title=f"Open the War Room for {s.po_number}",
                detail=(f"{s.late_orders_count} order(s) finish late without action (${s.sla_penalty_exposure:,.0f} penalties). "
                        + (f"Recommended: {s.recommended_strategy} for ${s.recommended_cost:,.0f}." if s.recommended_strategy else "")),
                route=f"/war-room/{s.id}",
                severity=s.impact_severity,
            ))
        else:
            actions.append(NextAction(
                priority=len(actions) + 1,
                title=f"Review {s.po_number} ({s.material_name})",
                detail="Shortage is covered by stock or schedule slack; monitor the revised ETA.",
                route=f"/disruptions/{s.id}",
                severity="medium",
            ))
    for i in inventory:
        if i.available_stock <= 0 and i.material:
            actions.append(NextAction(
                priority=len(actions) + 1,
                title=f"Replenish {i.material.sku}",
                detail=f"No free stock of {i.material.name}; reorder point is {i.reorder_point} {i.material.unit_of_measure}.",
                route="/inventory",
                severity="high",
            ))
    for i in inventory:
        if 0 < i.available_stock <= i.reorder_point and i.material:
            actions.append(NextAction(
                priority=len(actions) + 1,
                title=f"Reorder {i.material.sku}",
                detail=f"{i.available_stock} available vs reorder point {i.reorder_point}.",
                route="/inventory",
                severity="medium",
            ))
    actions = actions[:6]

    return DashboardSummary(
        generated_at=datetime.now(timezone.utc).isoformat(),
        demo_data=settings.SEED_DEMO_DATA,
        metrics=metrics,
        disruptions=summaries,
        critical_orders=critical_orders,
        timeline=timeline,
        next_actions=actions,
        recent_decisions=[decision_out(x) for x in db.query(RecoveryDecision).order_by(RecoveryDecision.decided_at.desc()).limit(5).all()],
    )
