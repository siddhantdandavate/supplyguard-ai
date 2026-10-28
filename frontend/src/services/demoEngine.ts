/**
 * Frontend client-side calculation engine for SupplyGuard AI Demo Mode.
 * Faithfully mirrors backend/app/services/engine.py to provide exact,
 * deterministic scenario simulations, tradeoffs, and recommendations in the browser.
 */

import {
  OrderOutcome,
  ProductionOrder,
  ScenarioAssumptions,
  ScenarioAssumptionOverrides,
  ScenarioResponse,
  StrategyKey,
  StrategyOutcome,
} from '../types/api';
import { DemoState } from './demoData';

export const STRATEGY_META: Record<StrategyKey, { name: string; short: string; description: string }> = {
  baseline: {
    name: 'Baseline: no intervention',
    short: 'Baseline',
    description: 'Accept the revised supplier ETA and absorb the resulting schedule slip and SLA penalties.',
  },
  expedite: {
    name: 'Expedited shipment',
    short: 'Expedite',
    description: 'Pay a freight premium so the delayed shipment arrives earlier than the revised ETA.',
  },
  alternate: {
    name: 'Alternate supplier',
    short: 'Alt. supplier',
    description: 'Buy the uncovered quantity from a qualified secondary source at a unit price premium.',
  },
  reallocation: {
    name: 'Inventory reallocation',
    short: 'Reallocate',
    description: 'Release stock reserved for orders whose deadlines can absorb the delay to the orders that cannot.',
  },
  combined: {
    name: 'Combined recovery plan',
    short: 'Combined',
    description: 'Expedite the shipment and reallocate reserved stock at the same time.',
  },
};

const STRATEGY_KEYS: StrategyKey[] = ['baseline', 'expedite', 'alternate', 'reallocation', 'combined'];

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + n);
  return res;
}

function diffDays(a: Date, b: Date): number {
  const msA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const msB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((msA - msB) / (24 * 3600 * 1000));
}

export function resolveAssumptions(
  delayDays: number,
  materialUnitCost: number,
  alternateLeadTime: number,
  overrides?: ScenarioAssumptionOverrides,
): ScenarioAssumptions {
  const safeDelay = Math.max(0, delayDays);
  const defaultExpediteSaved =
    safeDelay > 1 ? Math.max(0, Math.min(safeDelay - 1, Math.round(safeDelay * 0.6))) : 0;
  const defaultExpeditePerUnit = Math.round(Math.max(1.5, 0.35 * (materialUnitCost || 0.0)) * 100) / 100;

  return {
    delay_days: safeDelay,
    expedite_days_saved:
      overrides?.expedite_days_saved !== undefined
        ? Math.max(0, Math.min(overrides.expedite_days_saved, safeDelay))
        : defaultExpediteSaved,
    expedite_fixed_cost: overrides?.expedite_fixed_cost ?? 1500.0,
    expedite_cost_per_unit: overrides?.expedite_cost_per_unit ?? defaultExpeditePerUnit,
    alternate_lead_time_days: overrides?.alternate_lead_time_days ?? Math.max(0, alternateLeadTime),
    alternate_price_premium_pct: overrides?.alternate_price_premium_pct ?? 25.0,
    alternate_coverage_pct: overrides?.alternate_coverage_pct ?? 100.0,
    reallocation_handling_cost_per_unit: overrides?.reallocation_handling_cost_per_unit ?? 2.0,
  };
}

export function evaluateStrategyInDemo(
  key: StrategyKey,
  state: DemoState,
  delayId: number,
  assumptions: ScenarioAssumptions,
): StrategyOutcome {
  const delay = state.delays.find((d) => d.id === delayId);
  if (!delay) throw new Error(`Disruption ${delayId} not found`);

  const material = state.materials.find((m) => m.id === delay.material_id);
  const inv = state.inventory.find((i) => i.material_id === delay.material_id);
  const freePool = inv ? Math.max(0, inv.current_stock - inv.reserved_stock) : 0;

  // Open requirements for this material
  const openOrders = state.orders.filter((o) => o.status !== 'completed');
  const reqLines: Array<{ order: ProductionOrder; line: ProductionOrder['materials_required'][number] }> = openOrders
    .flatMap((o) => {
      const matLine = o.materials_required.find((m) => m.material_id === delay.material_id);
      return matLine ? [{ order: o, line: matLine }] : [];
    });

  // Priority sorting: customer score desc, committed date asc, id asc
  reqLines.sort((a, b) => {
    const scoreA = a.order.customer?.priority_score ?? 0;
    const scoreB = b.order.customer?.priority_score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    const dateA = a.order.committed_delivery_date;
    const dateB = b.order.committed_delivery_date;
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.order.id - b.order.id;
  });

  const origEta = parseDate(delay.original_eta);
  const baseArrival = addDays(origEta, assumptions.delay_days);

  let addedCost = 0.0;
  let unitsReallocated = 0;
  let unitsFromAlternate = 0;
  const risks: string[] = [];
  const supplyEvents: Array<{ date: Date; qty: number }> = [];

  let mainArrival = baseArrival;
  if (key === 'expedite' || key === 'combined') {
    mainArrival = addDays(baseArrival, -assumptions.expedite_days_saved);
    addedCost += assumptions.expedite_fixed_cost + assumptions.expedite_cost_per_unit * delay.quantity_delayed;
  }
  supplyEvents.push({ date: mainArrival, qty: delay.quantity_delayed });

  // Allocate free stock first
  const unfilled: Record<number, number> = {};
  for (const { order, line } of reqLines) {
    unfilled[order.id] = Math.max(0, line.quantity_required - line.quantity_allocated);
  }

  let pool = freePool;
  for (const { order } of reqLines) {
    if (pool <= 0) break;
    const needed = unfilled[order.id] || 0;
    const take = Math.min(pool, needed);
    unfilled[order.id] = needed - take;
    pool -= take;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Reallocation
  const donors: Record<number, number> = {};
  if (key === 'reallocation' || key === 'combined') {
    for (const { order, line } of reqLines) {
      if (line.quantity_allocated <= 0) continue;
      const plannedStart = parseDate(order.planned_start_date);
      const start = plannedStart > today ? plannedStart : today;
      const plannedComp = parseDate(order.planned_completion_date);
      const remainingBuildDays = Math.max(1, diffDays(plannedComp, start));
      const finishIfWaits = addDays(mainArrival, remainingBuildDays);
      const newComp = finishIfWaits > plannedComp ? finishIfWaits : plannedComp;
      const committed = parseDate(order.committed_delivery_date);
      const canAbsorb = newComp <= committed;

      // Check if lower priority than at least one needy order
      const needy = reqLines.filter((n) => (unfilled[n.order.id] || 0) > 0 && n.order.id !== order.id);
      const orderScore = order.customer?.priority_score ?? 0;
      const isDonorEligible = needy.some((n) => (n.order.customer?.priority_score ?? 0) > orderScore);

      if (canAbsorb && needy.length > 0 && isDonorEligible) {
        donors[order.id] = line.quantity_allocated;
      }
    }

    const totalDonated = Object.values(donors).reduce((s, v) => s + v, 0);
    if (totalDonated > 0) {
      for (const [oidStr, qty] of Object.entries(donors)) {
        const oid = Number(oidStr);
        unfilled[oid] = (unfilled[oid] || 0) + qty;
      }
      let reallocPool = totalDonated;
      for (const { order } of reqLines) {
        if (reallocPool <= 0) break;
        if (donors[order.id]) continue;
        const take = Math.min(reallocPool, unfilled[order.id] || 0);
        unfilled[order.id] = (unfilled[order.id] || 0) - take;
        reallocPool -= take;
        unitsReallocated += take;
      }
      // Leftovers return to donors
      for (const { order } of reqLines) {
        if (reallocPool <= 0) break;
        if (donors[order.id]) {
          const take = Math.min(reallocPool, unfilled[order.id] || 0);
          unfilled[order.id] = (unfilled[order.id] || 0) - take;
          reallocPool -= take;
        }
      }
      addedCost += unitsReallocated * assumptions.reallocation_handling_cost_per_unit;
    } else {
      risks.push('No reserved stock could be released: every order holding this material would itself become late.');
    }
  }

  const shortageImmediate = Object.values(unfilled).reduce((s, v) => s + v, 0);

  // Alternate supplier
  if (key === 'alternate') {
    const coverage = Math.ceil((shortageImmediate * assumptions.alternate_coverage_pct) / 100.0);
    if (coverage > 0) {
      const altArrival = addDays(today, assumptions.alternate_lead_time_days);
      supplyEvents.push({ date: altArrival, qty: coverage });
      unitsFromAlternate = coverage;
      addedCost += (coverage * (material?.unit_cost || 0.0) * assumptions.alternate_price_premium_pct) / 100.0;
      if (altArrival >= baseArrival) {
        risks.push("The alternate supplier's lead time is not shorter than the revised ETA, so it adds cost without recovering time.");
      }
    } else {
      risks.push('No uncovered demand remains, so there is nothing to source from an alternate supplier.');
    }
  }

  // Cover dates from supply events
  supplyEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  const coverDates: Record<number, Date | null> = {};
  const remainingToCover = { ...unfilled };
  for (const { order } of reqLines) {
    if ((remainingToCover[order.id] || 0) <= 0) coverDates[order.id] = null;
  }

  for (const ev of supplyEvents) {
    let evPool = ev.qty;
    for (const { order } of reqLines) {
      if ((remainingToCover[order.id] || 0) <= 0 || evPool <= 0) continue;
      const take = Math.min(evPool, remainingToCover[order.id] || 0);
      remainingToCover[order.id] = (remainingToCover[order.id] || 0) - take;
      evPool -= take;
      if (remainingToCover[order.id] === 0) {
        coverDates[order.id] = ev.date;
      }
    }
  }

  // Build Order Outcomes
  const orderOutcomes: OrderOutcome[] = [];
  let lateOrdersCount = 0;
  let remainingSlaPenalties = 0.0;
  let revenueAtRisk = 0.0;
  const lateCustNames = new Set<string>();

  for (const { order, line } of reqLines) {
    const cDate = coverDates[order.id] ?? null;
    const plannedStart = parseDate(order.planned_start_date);
    const start = plannedStart > today ? plannedStart : today;
    const plannedComp = parseDate(order.planned_completion_date);
    const remainingBuildDays = Math.max(1, diffDays(plannedComp, start));

    let projComp = plannedComp;
    if (cDate) {
      const finish = addDays(cDate, remainingBuildDays);
      projComp = finish > plannedComp ? finish : plannedComp;
    }

    const committed = parseDate(order.committed_delivery_date);
    const lateDays = Math.max(0, diffDays(projComp, committed));
    const penaltyPerDay = order.customer?.sla_penalty_per_day ?? 0;
    const slaPenalty = lateDays * penaltyPerDay;
    const isLate = lateDays > 0;

    if (isLate) {
      lateOrdersCount++;
      remainingSlaPenalties += slaPenalty;
      revenueAtRisk += order.revenue_value;
      if (order.customer?.name) lateCustNames.add(order.customer.name);
    }

    const unfilledBefore = Math.max(0, line.quantity_required - line.quantity_allocated);
    let role: 'affected' | 'donor' | 'unaffected' = 'unaffected';
    if (unfilledBefore > 0) role = 'affected';
    else if (donors[order.id]) role = 'donor';

    orderOutcomes.push({
      order_id: order.id,
      order_number: order.order_number,
      product_name: order.product_name,
      customer_id: order.customer_id,
      customer_name: order.customer?.name ?? 'Unknown Customer',
      customer_tier: order.customer?.tier ?? 'Standard',
      priority: order.priority,
      status: order.status,
      quantity_required: line.quantity_required,
      quantity_allocated: line.quantity_allocated,
      unfilled_before: unfilledBefore,
      unfilled_after_pool: unfilled[order.id] || 0,
      cover_date: cDate ? fmtDate(cDate) : null,
      planned_completion_date: order.planned_completion_date,
      committed_delivery_date: order.committed_delivery_date,
      projected_completion_date: fmtDate(projComp),
      late_days: lateDays,
      sla_penalty: slaPenalty,
      revenue_value: order.revenue_value,
      is_late: isLate,
      role,
    });
  }

  const remainingDelayDays = diffDays(mainArrival, origEta);
  const daysSaved = Math.max(0, assumptions.delay_days - remainingDelayDays);
  const shortageRemaining = Object.values(remainingToCover).reduce((s, v) => s + v, 0);

  const meta = STRATEGY_META[key];
  return {
    key,
    name: meta.name,
    description: meta.description,
    added_cost: Math.round(addedCost * 100) / 100,
    remaining_delay_days: remainingDelayDays,
    days_saved: daysSaved,
    supply_arrival_date: fmtDate(mainArrival),
    shortage_units_immediate: shortageImmediate,
    shortage_units_remaining: shortageRemaining,
    affected_orders_count: reqLines.filter((x) => x.line.quantity_required > x.line.quantity_allocated).length,
    late_orders_count: lateOrdersCount,
    protected_commitments: 0, // populated after baseline comparison
    customers_at_risk: lateCustNames.size,
    baseline_sla_penalties: 0.0, // populated after baseline
    remaining_sla_penalties: Math.round(remainingSlaPenalties * 100) / 100,
    penalties_avoided: 0.0,
    revenue_at_risk: Math.round(revenueAtRisk * 100) / 100,
    revenue_protected: 0.0,
    total_exposure: Math.round((addedCost + remainingSlaPenalties) * 100) / 100,
    net_benefit: 0.0,
    units_reallocated: unitsReallocated,
    units_from_alternate: unitsFromAlternate,
    recommended: false,
    explanation: '',
    risks,
    orders: orderOutcomes,
  };
}

export function simulateInDemo(
  state: DemoState,
  delayId: number,
  simulatedDelayDays: number | null,
  overrides?: ScenarioAssumptionOverrides,
): ScenarioResponse {
  const delay = state.delays.find((d) => d.id === delayId);
  if (!delay) throw new Error(`Disruption ${delayId} not found`);

  const material = state.materials.find((m) => m.id === delay.material_id);
  const supplier = state.suppliers.find((s) => s.id === delay.supplier_id);
  const altSupplier = material?.alternate_supplier_id
    ? state.suppliers.find((s) => s.id === material.alternate_supplier_id)
    : state.suppliers.find((s) => s.id !== delay.supplier_id);

  const delayDays = simulatedDelayDays !== null ? simulatedDelayDays : delay.delay_days;
  const assumptions = resolveAssumptions(
    delayDays,
    material?.unit_cost ?? 36.0,
    altSupplier?.lead_time_days ?? 9,
    overrides,
  );

  const strategies: StrategyOutcome[] = STRATEGY_KEYS.map((k) =>
    evaluateStrategyInDemo(k, state, delayId, assumptions),
  );

  const baseline = strategies.find((s) => s.key === 'baseline')!;

  for (const s of strategies) {
    s.baseline_sla_penalties = baseline.remaining_sla_penalties;
    s.penalties_avoided = Math.max(0, baseline.remaining_sla_penalties - s.remaining_sla_penalties);
    s.net_benefit = Math.round((s.penalties_avoided - s.added_cost) * 100) / 100;
    s.protected_commitments = Math.max(0, baseline.late_orders_count - s.late_orders_count);
    s.revenue_protected = Math.max(0, baseline.revenue_at_risk - s.revenue_at_risk);
  }

  // Recommended strategy has lowest total_exposure, tie-breaker fewest late orders, then lowest added cost
  const sorted = [...strategies].sort((a, b) => {
    if (Math.abs(a.total_exposure - b.total_exposure) > 0.01) return a.total_exposure - b.total_exposure;
    if (a.late_orders_count !== b.late_orders_count) return a.late_orders_count - b.late_orders_count;
    return a.added_cost - b.added_cost;
  });

  const best = sorted[0];
  best.recommended = true;

  // Generate clear plain-language explanations
  for (const s of strategies) {
    if (s.key === 'baseline') {
      s.explanation = `No recovery action taken: ${s.late_orders_count} orders finish late, incurring $${s.remaining_sla_penalties.toLocaleString()} in SLA penalties.`;
    } else {
      const savedDesc = s.days_saved > 0 ? `${s.days_saved} days recovered` : 'no days recovered';
      s.explanation = `${s.name}: $${s.added_cost.toLocaleString()} added cost (${savedDesc}) reduces penalties from $${baseline.remaining_sla_penalties.toLocaleString()} to $${s.remaining_sla_penalties.toLocaleString()}, avoiding $${s.penalties_avoided.toLocaleString()} in charges for a net benefit of $${s.net_benefit.toLocaleString()}.`;
    }
  }

  const origEta = parseDate(delay.original_eta);
  const revisedEta = addDays(origEta, delayDays);

  const inv = state.inventory.find((i) => i.material_id === delay.material_id);
  const freeStock = inv ? Math.max(0, inv.current_stock - inv.reserved_stock) : 0;

  const executiveSummary = `${best.name} is recommended: $${best.added_cost.toLocaleString()} added cost avoids $${best.penalties_avoided.toLocaleString()} in penalties and protects ${best.protected_commitments} of ${baseline.affected_orders_count} affected commitments (total exposure $${best.total_exposure.toLocaleString()} vs $${baseline.total_exposure.toLocaleString()} baseline).`;

  return {
    delay_id: delay.id,
    po_number: delay.po_number,
    material_id: delay.material_id,
    material_sku: material?.sku ?? 'MAT-OPT-SENS',
    material_name: material?.name ?? 'Optical Rotary Encoder 1024 PPR',
    supplier_name: supplier?.name ?? 'Apex Precision Sensors',
    original_eta: delay.original_eta,
    revised_eta: fmtDate(revisedEta),
    reported_delay_days: delay.delay_days,
    simulated_delay_days: delayDays,
    free_stock: freeStock,
    total_unfilled_demand: baseline.shortage_units_immediate,
    assumptions,
    strategies,
    recommended_key: best.key,
    summary: executiveSummary,
  };
}
