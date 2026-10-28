import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  Target,
} from 'lucide-react';
import { ScenarioResponse, StrategyOutcome } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { fmtDate, fmtMoney, fmtNumber } from '../../lib/format';

interface Props {
  result: ScenarioResponse;
  recommended: StrategyOutcome;
  baseline: StrategyOutcome;
  onAdopt: () => void;
  hasAdoptedPlan: boolean;
  adoptedPlanName?: string;
  isCustomSimulated: boolean;
}

export const GuidedDecisionSummary: React.FC<Props> = ({
  result,
  recommended,
  baseline,
  onAdopt,
  hasAdoptedPlan,
  adoptedPlanName,
  isCustomSimulated,
}) => {
  // Extract affected and late orders for baseline
  const baselineLateOrders = baseline.orders.filter((o) => o.is_late);
  const baselineLateOrderNums = baselineLateOrders.map((o) => `${o.order_number} (${o.late_days}d late)`).join(', ');

  // Extract unique customer names at risk
  const customersAtRisk = Array.from(new Set(baseline.orders.filter((o) => o.is_late).map((o) => o.customer_name))).join(', ');

  // Extract remaining late orders for recommended strategy
  const recLateOrders = recommended.orders.filter((o) => o.is_late);
  const recLateOrderNums = recLateOrders.map((o) => `${o.order_number} (${o.customer_name}, ${o.late_days}d late)`).join(', ');

  // Donor orders if reallocation is involved
  const donorOrders = recommended.orders.filter((o) => o.role === 'donor').map((o) => o.order_number).join(', ');

  // Dynamic plain language action description
  const getActionDescription = () => {
    switch (recommended.key) {
      case 'combined':
        return `Expedite the delayed shipment of ${result.material_name} to save ${recommended.days_saved} days of transit, and reallocate ${fmtNumber(recommended.units_reallocated)} units of reserved warehouse stock${donorOrders ? ` from order(s) ${donorOrders}` : ''} to protect critical customer deadlines.`;
      case 'expedite':
        return `Book priority carrier freight to expedite shipment ${result.po_number}, recovering ${recommended.days_saved} days of transit delay so the parts arrive on ${fmtDate(recommended.supply_arrival_date)}.`;
      case 'alternate':
        return `Purchase ${fmtNumber(recommended.units_from_alternate)} uncovered units immediately from a qualified alternate supplier with a ${result.assumptions.alternate_lead_time_days ?? 14}-day lead time.`;
      case 'reallocation':
        return `Reallocate ${fmtNumber(recommended.units_reallocated)} units of inventory currently reserved for lower-priority orders${donorOrders ? ` (${donorOrders})` : ''} to higher-priority orders whose delivery dates are at risk.`;
      case 'baseline':
      default:
        return `Accept the revised supplier ETA without paid recovery action. Under current conditions, the cost of expediting or alternate sourcing exceeds the avoidable SLA penalties.`;
    }
  };

  return (
    <section
      aria-labelledby="guided-summary-heading"
      className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-card transition-all"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-gradient-to-r from-sky-50 via-sky-50/50 to-white px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
            <Compass className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="guided-summary-heading" className="text-base font-semibold text-slate-900">
                Planner Guided Decision Summary
              </h2>
              <Badge tone="info">Plain Language</Badge>
              {isCustomSimulated && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  Simulated ({result.simulated_delay_days}d delay)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Clear operational breakdown for plant planners and shop-floor management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasAdoptedPlan && (
            <span className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Adopted: {adoptedPlanName}
            </span>
          )}
          <Button
            size="sm"
            onClick={onAdopt}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {hasAdoptedPlan ? 'Change Adopted Plan' : 'Adopt Recommended Plan'}
          </Button>
        </div>
      </div>

      {/* Structured 5-Part Guided Layout */}
      <div className="divide-y divide-slate-100 p-0 text-sm">
        {/* 1. Situation: What happened? */}
        <div className="p-5 sm:p-6 bg-slate-50/30">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">1. Situation</span>
                <span className="text-xs font-medium text-slate-500">What happened?</span>
              </div>
              <p className="text-slate-800 leading-relaxed font-medium">
                Supplier <strong className="text-slate-900">{result.supplier_name}</strong> reported a{' '}
                <strong className="text-rose-700">{result.simulated_delay_days}-day delay</strong> on purchase order{' '}
                <strong className="text-slate-900">{result.po_number}</strong> ({result.material_name}).
                The delivery is pushed from <span className="underline decoration-slate-300">{fmtDate(result.original_eta)}</span> to{' '}
                <strong className="text-slate-900">{fmtDate(result.revised_eta)}</strong>.
              </p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs text-slate-600">
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <span className="text-slate-400 block font-medium">Material Shortage</span>
                  <span className="text-slate-900 font-semibold">{fmtNumber(result.total_unfilled_demand)} units short</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">({fmtNumber(result.free_stock)} free stock used)</span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <span className="text-slate-400 block font-medium">Impacted Orders</span>
                  <span className="text-slate-900 font-semibold">{baseline.late_orders_count} of {baseline.affected_orders_count} orders late</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5 truncate" title={baselineLateOrderNums}>
                    {baselineLateOrderNums || 'No late orders'}
                  </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2.5">
                  <span className="text-slate-400 block font-medium">Customer Exposure</span>
                  <span className="text-rose-700 font-semibold">{fmtMoney(baseline.remaining_sla_penalties)} SLA penalties</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5 truncate" title={customersAtRisk}>
                    {customersAtRisk ? `At risk: ${customersAtRisk}` : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Recommended Action: What should I do? */}
        <div className="p-5 sm:p-6 bg-emerald-50/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">2. Recommended Action</span>
                <span className="text-xs font-medium text-slate-500">What should I do?</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {recommended.name}
              </h3>
              <p className="text-slate-700 leading-relaxed">
                {getActionDescription()}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Why This Plan: Why is this recommended? */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700">
              <Target className="h-4 w-4" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-800">3. Why This Plan</span>
                <span className="text-xs font-medium text-slate-500">Why is this recommended?</span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Paying <strong className="text-slate-900">{fmtMoney(recommended.added_cost)}</strong> in added recovery costs avoids{' '}
                <strong className="text-emerald-700">{fmtMoney(recommended.penalties_avoided)}</strong> in contractual SLA penalties,
                producing a <strong className="text-emerald-700">net benefit of +{fmtMoney(recommended.net_benefit)}</strong>.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                <li className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>{recommended.days_saved} days recovered:</strong> arrival advanced from{' '}
                    {fmtDate(result.revised_eta)} to {fmtDate(recommended.supply_arrival_date)}.
                  </span>
                </li>
                <li className="flex items-center gap-2 rounded-md bg-slate-50 p-2.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    <strong>{recommended.protected_commitments} of {recommended.affected_orders_count} customer commitments protected</strong>{' '}
                    ({fmtMoney(recommended.revenue_protected)} revenue delivered on time).
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 4. Remaining Risks: What remains at risk? */}
        <div className="p-5 sm:p-6 bg-amber-50/25">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">4. Remaining Risks</span>
                <span className="text-xs font-medium text-slate-500">What remains at risk?</span>
              </div>
              {recommended.late_orders_count > 0 ? (
                <div className="rounded-md border border-amber-200 bg-white p-3 text-xs text-slate-800">
                  <span className="font-semibold text-rose-700 block">
                    {recommended.late_orders_count} production order(s) will still finish late:
                  </span>
                  <span className="text-slate-600 mt-1 block">
                    {recLateOrderNums}. Remaining contractual penalty:{' '}
                    <strong className="text-rose-700">{fmtMoney(recommended.remaining_sla_penalties)}</strong>.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  All customer commitments finish on schedule under this plan. Zero residual SLA penalties.
                </div>
              )}

              {recommended.shortage_units_remaining > 0 && (
                <div className="text-xs text-rose-700">
                  <strong>Shortage alert:</strong> {fmtNumber(recommended.shortage_units_remaining)} units remain uncovered by scheduled supply.
                </div>
              )}

              {recommended.risks.length > 0 && (
                <div className="space-y-1 text-xs text-slate-600 pt-1">
                  <span className="font-semibold text-slate-700 block">Operational precautions:</span>
                  {recommended.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Next Step: What happens if I adopt this plan? */}
        <div className="p-5 sm:p-6 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">5. Next Step</span>
                  <span className="text-xs font-medium text-slate-500">What happens if I adopt this plan?</span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Adopting commits this recovery strategy, marks disruption <strong>{result.po_number}</strong> as{' '}
                  <span className="font-semibold text-emerald-700">Mitigated</span>, updates shop-floor schedules,
                  and records the audit log with your name and parameters.
                </p>
              </div>
            </div>

            <div className="flex-shrink-0">
              <Button
                onClick={onAdopt}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
              >
                {hasAdoptedPlan ? 'Update / Re-Adopt Plan' : 'Adopt This Plan'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
