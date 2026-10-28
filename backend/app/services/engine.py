"""
SupplyGuard recovery calculation engine.

Everything here is deterministic and derived from database records plus a small set
of documented, user-adjustable assumptions. No numbers are invented.

Model
-----
A supplier shipment delay concerns one material. Every open production order that
requires that material has an *unfilled* quantity (required - allocated). Free stock
(current - reserved) is allocated to unfilled demand in priority order (customer
priority score, then committed delivery date). Whatever is still unfilled must wait
for incoming supply.

Incoming supply is a list of (arrival_date, quantity) events. The baseline supply is
the delayed shipment arriving at original_eta + delay_days. Recovery strategies change
the supply events and/or the free pool:

* baseline        - no intervention.
* expedite        - the delayed shipment arrives `expedite_days_saved` days earlier.
                    Cost = expedite_fixed_cost + expedite_cost_per_unit * quantity_delayed.
* alternate       - a qualified secondary source ships the uncovered quantity in
                    `alternate_lead_time_days`. Cost = covered units * unit_cost * premium %.
                    The original shipment still arrives on its revised date.
* reallocation    - stock already allocated to orders whose deadlines can absorb the
                    delay without becoming late is released to higher-priority orders.
                    Cost = handling cost per unit moved.
* combined        - expedite + reallocation.

An order is blocked until its unfilled demand is covered by supply. Its new completion
date is cover_date + remaining build days (planned_completion - max(today, planned_start)).
Late days = max(0, new_completion - committed_delivery). SLA penalty = late days *
customer.sla_penalty_per_day. Revenue at risk = revenue of orders that finish late.

The recommended strategy is the one with the lowest total exposure
(added cost + remaining SLA penalties), tie-broken by fewer late orders, then lower cost.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.disruption import ProductionOrder, ProductionOrderMaterial, ShipmentDelay
from app.models.inventory import Inventory
from app.models.material import Material
from app.models.supplier import Supplier

STRATEGY_KEYS = ["baseline", "expedite", "alternate", "reallocation", "combined"]

STRATEGY_META = {
    "baseline": {
        "name": "Baseline: no intervention",
        "short": "Baseline",
        "description": "Accept the revised supplier ETA and absorb the resulting schedule slip and SLA penalties.",
    },
    "expedite": {
        "name": "Expedited shipment",
        "short": "Expedite",
        "description": "Pay a freight premium so the delayed shipment arrives earlier than the revised ETA.",
    },
    "alternate": {
        "name": "Alternate supplier",
        "short": "Alt. supplier",
        "description": "Buy the uncovered quantity from a qualified secondary source at a unit price premium.",
    },
    "reallocation": {
        "name": "Inventory reallocation",
        "short": "Reallocate",
        "description": "Release stock reserved for orders whose deadlines can absorb the delay to the orders that cannot.",
    },
    "combined": {
        "name": "Combined recovery plan",
        "short": "Combined",
        "description": "Expedite the shipment and reallocate reserved stock at the same time.",
    },
}

# Legacy keys accepted from older clients.
LEGACY_STRATEGY_ALIASES = {
    "none": "baseline",
    "air_expedite": "expedite",
    "split_supplier": "alternate",
    "shift_overtime": "reallocation",
}


@dataclass
class Assumptions:
    """User-adjustable scenario assumptions. None means 'derive a default from the data'."""

    delay_days: int
    expedite_days_saved: Optional[int] = None
    expedite_fixed_cost: float = 1500.0
    expedite_cost_per_unit: Optional[float] = None
    alternate_lead_time_days: Optional[int] = None
    alternate_price_premium_pct: float = 25.0
    alternate_coverage_pct: float = 100.0
    reallocation_handling_cost_per_unit: float = 2.0

    def resolved(self, delay: ShipmentDelay, material: Material, db: Session) -> "Assumptions":
        """Fill None fields with defaults derived from the data. Returns a new instance."""
        a = Assumptions(**asdict(self))
        a.delay_days = max(0, int(a.delay_days))

        if a.expedite_days_saved is None:
            # Premium freight typically recovers about 60% of a transit delay; never below 1 day of delay remaining.
            a.expedite_days_saved = max(0, min(a.delay_days - 1, round(a.delay_days * 0.6))) if a.delay_days > 1 else 0
        a.expedite_days_saved = max(0, min(int(a.expedite_days_saved), a.delay_days))

        if a.expedite_cost_per_unit is None:
            # Premium freight surcharge assumed at 35% of part value, minimum $1.50 per unit.
            a.expedite_cost_per_unit = round(max(1.5, 0.35 * float(material.unit_cost or 0.0)), 2)

        if a.alternate_lead_time_days is None:
            alt: Optional[Supplier] = None
            if getattr(material, "alternate_supplier_id", None):
                alt = db.query(Supplier).filter(Supplier.id == material.alternate_supplier_id).first()
            if alt is not None:
                a.alternate_lead_time_days = int(alt.lead_time_days)
            else:
                others = (
                    db.query(Supplier)
                    .filter(Supplier.id != delay.supplier_id)
                    .order_by(Supplier.lead_time_days.asc())
                    .all()
                )
                a.alternate_lead_time_days = int(others[0].lead_time_days) if others else int(material.standard_lead_time_days)
        a.alternate_lead_time_days = max(0, int(a.alternate_lead_time_days))
        a.alternate_price_premium_pct = max(0.0, float(a.alternate_price_premium_pct))
        a.alternate_coverage_pct = min(100.0, max(0.0, float(a.alternate_coverage_pct)))
        a.expedite_fixed_cost = max(0.0, float(a.expedite_fixed_cost))
        a.reallocation_handling_cost_per_unit = max(0.0, float(a.reallocation_handling_cost_per_unit))
        return a


@dataclass
class OrderOutcome:
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
    role: str  # "affected" | "donor" | "unaffected"


@dataclass
class StrategyOutcome:
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
    risks: List[str] = field(default_factory=list)
    orders: List[OrderOutcome] = field(default_factory=list)


@dataclass
class ScenarioAnalysis:
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
    strategies: List[StrategyOutcome]
    recommended_key: str
    summary: str


# --------------------------------------------------------------------------- helpers


def _today() -> date:
    return date.today()


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _priority_key(order: ProductionOrder) -> Tuple:
    score = order.customer.priority_score if order.customer else 0
    return (-score, order.committed_delivery_date, order.id)


def _remaining_build_days(order: ProductionOrder, today: date) -> int:
    start = max(order.planned_start_date, today)
    return max(1, (order.planned_completion_date - start).days)


def open_requirements(db: Session, material_id: int) -> List[ProductionOrderMaterial]:
    """BOM lines for the material on orders that are not completed."""
    lines = (
        db.query(ProductionOrderMaterial)
        .filter(ProductionOrderMaterial.material_id == material_id)
        .all()
    )
    return [l for l in lines if l.production_order and l.production_order.status != "completed"]


def _allocate(unfilled: Dict[int, int], ordered: List[ProductionOrderMaterial], pool: int) -> int:
    """Allocate pool to unfilled demand in priority order. Mutates `unfilled`, returns leftover pool."""
    for line in ordered:
        if pool <= 0:
            break
        oid = line.production_order_id
        take = min(pool, unfilled[oid])
        unfilled[oid] -= take
        pool -= take
    return pool


def _cover_dates(
    unfilled: Dict[int, int],
    ordered: List[ProductionOrderMaterial],
    supply_events: List[Tuple[date, int]],
) -> Dict[int, Optional[date]]:
    """Walk supply events in date order and determine the date each order's demand is fully covered."""
    cover: Dict[int, Optional[date]] = {line.production_order_id: None for line in ordered}
    remaining = dict(unfilled)
    for oid, qty in remaining.items():
        if qty <= 0:
            cover[oid] = None  # already covered from stock
    events = sorted(supply_events, key=lambda e: e[0])
    for arrival, qty in events:
        pool = qty
        for line in ordered:
            oid = line.production_order_id
            if remaining[oid] <= 0 or pool <= 0:
                continue
            take = min(pool, remaining[oid])
            remaining[oid] -= take
            pool -= take
            if remaining[oid] == 0:
                cover[oid] = arrival
    return cover


# --------------------------------------------------------------------------- core


def evaluate_strategy(
    db: Session,
    delay: ShipmentDelay,
    key: str,
    assumptions: Assumptions,
    today: Optional[date] = None,
) -> StrategyOutcome:
    today = today or _today()
    material: Material = delay.material
    inv: Optional[Inventory] = db.query(Inventory).filter(Inventory.material_id == delay.material_id).first()
    free_pool = inv.available_stock if inv else 0

    lines = open_requirements(db, delay.material_id)
    ordered = sorted(lines, key=lambda l: _priority_key(l.production_order))
    unfilled_before = {l.production_order_id: max(0, l.quantity_required - l.quantity_allocated) for l in ordered}

    # Baseline supply: the delayed shipment arrives original_eta + simulated delay
    base_arrival = delay.original_eta + timedelta(days=assumptions.delay_days)

    added_cost = 0.0
    units_reallocated = 0
    units_from_alternate = 0
    risks: List[str] = []
    supply_events: List[Tuple[date, int]] = []
    main_arrival = base_arrival
    donors: Dict[int, int] = {}

    if key in ("expedite", "combined"):
        main_arrival = base_arrival - timedelta(days=assumptions.expedite_days_saved)
        added_cost += assumptions.expedite_fixed_cost + assumptions.expedite_cost_per_unit * delay.quantity_delayed
    supply_events.append((main_arrival, delay.quantity_delayed))

    # Allocate free stock first (all strategies)
    unfilled = dict(unfilled_before)
    pool = _allocate(unfilled, ordered, free_pool)

    if key in ("reallocation", "combined"):
        # Donors: orders holding allocated units whose deadline absorbs waiting for `main_arrival`.
        for line in ordered:
            o = line.production_order
            if line.quantity_allocated <= 0:
                continue
            new_completion = max(o.planned_completion_date, main_arrival + timedelta(days=_remaining_build_days(o, today)))
            can_absorb = new_completion <= o.committed_delivery_date
            # Donor must be lower priority than at least one still-unfilled order.
            needy = [l for l in ordered if unfilled[l.production_order_id] > 0 and l.production_order_id != o.id]
            if can_absorb and needy and any(_priority_key(n.production_order) < _priority_key(o) for n in needy):
                donors[o.id] = line.quantity_allocated
        donated = sum(donors.values())
        if donated > 0:
            # Donors now depend on incoming supply for their donated units.
            for oid, qty in donors.items():
                unfilled[oid] += qty
            pool += donated
            # Re-allocate to needy, highest priority first, but never back to donors.
            for line in ordered:
                oid = line.production_order_id
                if pool <= 0:
                    break
                if oid in donors:
                    continue
                take = min(pool, unfilled[oid])
                unfilled[oid] -= take
                pool -= take
                units_reallocated += take
            # Anything not consumed goes back to the donors in priority order.
            for line in ordered:
                oid = line.production_order_id
                if pool <= 0:
                    break
                if oid in donors:
                    take = min(pool, unfilled[oid])
                    unfilled[oid] -= take
                    pool -= take
            added_cost += units_reallocated * assumptions.reallocation_handling_cost_per_unit
        else:
            risks.append("No reserved stock could be released: every order holding this material would itself become late.")

    shortage_immediate = sum(unfilled.values())

    if key == "alternate":
        coverage = int(math.ceil(shortage_immediate * assumptions.alternate_coverage_pct / 100.0))
        if coverage > 0:
            alt_arrival = today + timedelta(days=assumptions.alternate_lead_time_days)
            supply_events.append((alt_arrival, coverage))
            units_from_alternate = coverage
            added_cost += coverage * float(material.unit_cost or 0.0) * assumptions.alternate_price_premium_pct / 100.0
            if alt_arrival >= base_arrival:
                risks.append("The alternate supplier's lead time is not shorter than the revised ETA, so it adds cost without recovering time.")
        else:
            risks.append("No uncovered demand remains, so there is nothing to source from an alternate supplier.")

    cover = _cover_dates(unfilled, ordered, supply_events)

    # Per-order outcomes
    outcomes: List[OrderOutcome] = []
    remaining_pen = 0.0
    late_orders = 0
    revenue_at_risk = 0.0
    customers_late = set()
    remaining_shortage = 0
    for line in ordered:
        o = line.production_order
        oid = o.id
        cover_date = cover.get(oid)
        if unfilled[oid] > 0 and cover_date is None:
            # Not enough supply at all in the horizon: treat as covered by the last supply event.
            remaining_shortage += unfilled[oid]
            cover_date = max(e[0] for e in supply_events)
        if unfilled[oid] > 0 and cover_date is not None:
            projected = max(o.planned_completion_date, cover_date + timedelta(days=_remaining_build_days(o, today)))
        else:
            projected = o.planned_completion_date
        late_days = max(0, (projected - o.committed_delivery_date).days)
        pen_rate = o.customer.sla_penalty_per_day if o.customer else 0.0
        penalty = late_days * pen_rate
        is_late = late_days > 0
        if is_late:
            late_orders += 1
            revenue_at_risk += float(o.revenue_value or 0.0)
            if o.customer_id:
                customers_late.add(o.customer_id)
        remaining_pen += penalty
        role = "donor" if oid in donors else ("affected" if unfilled_before[oid] > 0 else "unaffected")
        outcomes.append(
            OrderOutcome(
                order_id=oid,
                order_number=o.order_number,
                product_name=o.product_name,
                customer_id=o.customer_id,
                customer_name=o.customer.name if o.customer else "Unknown customer",
                customer_tier=o.customer.tier if o.customer else "",
                priority=o.priority,
                status=o.status,
                quantity_required=line.quantity_required,
                quantity_allocated=line.quantity_allocated,
                unfilled_before=unfilled_before[oid],
                unfilled_after_pool=unfilled[oid],
                cover_date=_iso(cover_date) if unfilled[oid] > 0 else None,
                planned_completion_date=_iso(o.planned_completion_date),
                committed_delivery_date=_iso(o.committed_delivery_date),
                projected_completion_date=_iso(projected),
                late_days=late_days,
                sla_penalty=round(penalty, 2),
                revenue_value=float(o.revenue_value or 0.0),
                is_late=is_late,
                role=role,
            )
        )

    affected = [oc for oc in outcomes if oc.unfilled_before > 0]
    protected = sum(1 for oc in affected if not oc.is_late)
    total_revenue_affected = sum(oc.revenue_value for oc in affected)

    meta = STRATEGY_META[key]
    earliest_supply = min(e[0] for e in supply_events) if supply_events else base_arrival
    remaining_delay = max(0, (main_arrival - delay.original_eta).days)
    if key == "alternate" and units_from_alternate > 0:
        remaining_delay = max(0, (earliest_supply - delay.original_eta).days)
    days_saved = max(0, assumptions.delay_days - remaining_delay)

    return StrategyOutcome(
        key=key,
        name=meta["name"],
        description=meta["description"],
        added_cost=round(added_cost, 2),
        remaining_delay_days=remaining_delay,
        days_saved=days_saved,
        supply_arrival_date=_iso(earliest_supply),
        shortage_units_immediate=shortage_immediate,
        shortage_units_remaining=remaining_shortage,
        affected_orders_count=len(affected),
        late_orders_count=late_orders,
        protected_commitments=protected,
        customers_at_risk=len(customers_late),
        baseline_sla_penalties=0.0,  # filled by analyze()
        remaining_sla_penalties=round(remaining_pen, 2),
        penalties_avoided=0.0,  # filled by analyze()
        revenue_at_risk=round(revenue_at_risk, 2),
        revenue_protected=round(total_revenue_affected - revenue_at_risk, 2),
        total_exposure=round(added_cost + remaining_pen, 2),
        net_benefit=0.0,  # filled by analyze()
        units_reallocated=units_reallocated,
        units_from_alternate=units_from_alternate,
        recommended=False,
        explanation="",
        risks=risks,
        orders=outcomes,
    )


def _money(v: float) -> str:
    return f"${v:,.0f}"


def _explain(delay: ShipmentDelay, s: StrategyOutcome, baseline: StrategyOutcome, a: Assumptions) -> str:
    late = [o for o in s.orders if o.is_late]
    late_txt = ", ".join(f"{o.order_number} ({o.late_days}d late)" for o in late) if late else "none"
    parts: List[str] = []
    if s.key == "baseline":
        parts.append(
            f"Doing nothing leaves the {delay.material.name} shipment arriving {s.remaining_delay_days} days after the original ETA."
        )
        parts.append(
            f"{s.affected_orders_count} order(s) are short {s.shortage_units_immediate} units after using free stock; "
            f"{s.late_orders_count} finish late ({late_txt}), creating {_money(s.remaining_sla_penalties)} in SLA penalties "
            f"and putting {_money(s.revenue_at_risk)} of revenue at risk."
        )
        return " ".join(parts)
    if s.key == "expedite":
        parts.append(
            f"Expediting recovers {s.days_saved} of {a.delay_days} delay days for {_money(s.added_cost)} "
            f"({_money(a.expedite_fixed_cost)} fixed + ${a.expedite_cost_per_unit:,.2f}/unit x {delay.quantity_delayed} units)."
        )
    elif s.key == "alternate":
        parts.append(
            f"Sourcing {s.units_from_alternate} units from a secondary supplier with a {a.alternate_lead_time_days}-day lead time "
            f"costs {_money(s.added_cost)} ({a.alternate_price_premium_pct:.0f}% premium on {_money(delay.material.unit_cost)}/unit)."
        )
    elif s.key == "reallocation":
        if s.units_reallocated > 0:
            donors = [o.order_number for o in s.orders if o.role == "donor"]
            parts.append(
                f"Releasing {s.units_reallocated} reserved units from {', '.join(donors)} covers higher-priority demand immediately "
                f"for {_money(s.added_cost)} in handling."
            )
        else:
            parts.append("No reserved stock can be released without making another order late, so this strategy changes nothing.")
    elif s.key == "combined":
        parts.append(
            f"Expediting ({s.days_saved} days recovered) plus releasing {s.units_reallocated} reserved units costs {_money(s.added_cost)}."
        )
    parts.append(
        f"Late orders drop from {baseline.late_orders_count} to {s.late_orders_count} ({late_txt}); "
        f"SLA penalties fall from {_money(baseline.remaining_sla_penalties)} to {_money(s.remaining_sla_penalties)}, "
        f"avoiding {_money(s.penalties_avoided)} for a net {'benefit' if s.net_benefit >= 0 else 'loss'} of {_money(abs(s.net_benefit))}."
    )
    if s.protected_commitments == s.affected_orders_count and s.affected_orders_count > 0:
        parts.append("Every affected customer commitment is protected.")
    elif s.protected_commitments > 0:
        parts.append(f"{s.protected_commitments} of {s.affected_orders_count} affected commitments are protected.")
    return " ".join(parts)


def analyze(
    db: Session,
    delay: ShipmentDelay,
    assumptions: Optional[Assumptions] = None,
    today: Optional[date] = None,
) -> ScenarioAnalysis:
    """Evaluate every strategy for a delay and pick a recommendation."""
    today = today or _today()
    material: Material = delay.material
    base_assumptions = assumptions or Assumptions(delay_days=delay.delay_days)
    a = base_assumptions.resolved(delay, material, db)

    results: Dict[str, StrategyOutcome] = {k: evaluate_strategy(db, delay, k, a, today) for k in STRATEGY_KEYS}
    baseline = results["baseline"]
    for s in results.values():
        s.baseline_sla_penalties = baseline.remaining_sla_penalties
        s.penalties_avoided = round(max(0.0, baseline.remaining_sla_penalties - s.remaining_sla_penalties), 2)
        s.net_benefit = round(s.penalties_avoided - s.added_cost, 2)
        if s.key != "baseline" and s.days_saved == 0 and s.units_reallocated == 0 and s.units_from_alternate == 0:
            s.risks.append("This strategy does not change the outcome under the current assumptions.")
        if s.late_orders_count > 0:
            s.risks.append(f"{s.late_orders_count} order(s) still finish late; remaining penalties {_money(s.remaining_sla_penalties)}.")
        if s.shortage_units_remaining > 0:
            s.risks.append(f"{s.shortage_units_remaining} units remain uncovered by any scheduled supply.")
        if s.key in ("expedite", "combined") and s.days_saved > 0:
            s.risks.append("Expedite assumes the carrier can honour the shorter transit; confirm capacity before committing.")
        if s.key == "alternate" and s.units_from_alternate > 0:
            s.risks.append("Alternate-source parts need incoming inspection and may require re-qualification.")
        if s.key in ("reallocation", "combined") and s.units_reallocated > 0:
            s.risks.append("Donor orders now depend on the delayed shipment; any further slip pushes them late.")

    ranked = sorted(
        results.values(),
        key=lambda s: (s.total_exposure, s.late_orders_count, s.added_cost, STRATEGY_KEYS.index(s.key)),
    )
    recommended = ranked[0]
    recommended.recommended = True
    for s in results.values():
        s.explanation = _explain(delay, s, baseline, a)

    strategies = [results[k] for k in STRATEGY_KEYS]
    total_unfilled = sum(o.unfilled_before for o in baseline.orders)
    inv = db.query(Inventory).filter(Inventory.material_id == delay.material_id).first()

    if recommended.key == "baseline":
        summary = (
            f"No recovery action pays for itself: the cheapest outcome is to accept the delay "
            f"({_money(baseline.remaining_sla_penalties)} exposure)."
        )
    else:
        summary = (
            f"{recommended.name} is recommended: {_money(recommended.added_cost)} added cost avoids "
            f"{_money(recommended.penalties_avoided)} in penalties and protects {recommended.protected_commitments} of "
            f"{recommended.affected_orders_count} affected commitments (total exposure {_money(recommended.total_exposure)} "
            f"vs {_money(baseline.total_exposure)} baseline)."
        )

    return ScenarioAnalysis(
        delay_id=delay.id,
        po_number=delay.po_number,
        material_id=delay.material_id,
        material_sku=material.sku,
        material_name=material.name,
        supplier_name=delay.supplier.name if delay.supplier else "",
        original_eta=_iso(delay.original_eta),
        revised_eta=_iso(delay.original_eta + timedelta(days=a.delay_days)),
        reported_delay_days=delay.delay_days,
        simulated_delay_days=a.delay_days,
        free_stock=inv.available_stock if inv else 0,
        total_unfilled_demand=total_unfilled,
        assumptions=asdict(a),
        strategies=strategies,
        recommended_key=recommended.key,
        summary=summary,
    )


def baseline_impact(db: Session, delay: ShipmentDelay, today: Optional[date] = None) -> StrategyOutcome:
    """Baseline (no intervention) impact at the reported delay. Used by dashboard and list views."""
    a = Assumptions(delay_days=delay.delay_days).resolved(delay, delay.material, db)
    s = evaluate_strategy(db, delay, "baseline", a, today)
    s.baseline_sla_penalties = s.remaining_sla_penalties
    return s


def normalize_strategy_key(key: str) -> str:
    k = (key or "").strip().lower()
    k = LEGACY_STRATEGY_ALIASES.get(k, k)
    return k if k in STRATEGY_KEYS else "expedite"
