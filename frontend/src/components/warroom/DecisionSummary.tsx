import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, ShieldCheck, Target } from 'lucide-react';
import { OrderOutcome, StrategyOutcome } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Table, Column } from '../ui/Table';
import { fmtDate, fmtMoney, fmtNumber } from '../../lib/format';

interface Props {
  strategy: StrategyOutcome;
  baseline: StrategyOutcome;
}

export const DecisionSummary: React.FC<Props> = ({ strategy: s, baseline }) => {
  const lateDelta = baseline.late_orders_count - s.late_orders_count;
  const impactOrders = s.orders.filter((o) => o.unfilled_before > 0 || o.role === 'donor');

  const columns: Column<OrderOutcome>[] = [
    { key: 'order', header: 'Order', render: (o) => <Link to={`/orders/${o.order_id}`} className="font-medium text-sky-700 hover:underline">{o.order_number}</Link> },
    { key: 'customer', header: 'Customer', render: (o) => (<span><span className="block">{o.customer_name}</span><span className="block text-xs text-slate-500">{o.customer_tier}</span></span>) },
    { key: 'role', header: 'Role', render: (o) => o.role === 'donor' ? <Badge tone="info">Donor stock</Badge> : <Badge tone="neutral">Affected</Badge> },
    { key: 'short', header: 'Short after stock', render: (o) => <span className="tabular-nums">{fmtNumber(o.unfilled_after_pool)}</span>, align: 'right' },
    { key: 'cover', header: 'Covered by supply', render: (o) => (o.cover_date ? fmtDate(o.cover_date) : <span className="text-emerald-700">From stock</span>) },
    { key: 'committed', header: 'Committed', render: (o) => fmtDate(o.committed_delivery_date) },
    { key: 'projected', header: 'Projected finish', render: (o) => <span className={o.is_late ? 'text-rose-700' : 'text-emerald-700'}>{fmtDate(o.projected_completion_date)}</span> },
    { key: 'result', header: 'Result', render: (o) => (o.is_late ? <Badge tone="critical">{o.late_days} days late</Badge> : <Badge tone="success">On time</Badge>), sortValue: (o) => o.late_days },
    { key: 'penalty', header: 'SLA penalty', render: (o) => <span className={o.sla_penalty > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}>{fmtMoney(o.sla_penalty)}</span>, align: 'right', sortValue: (o) => o.sla_penalty },
  ];

  return (
    <div className="space-y-5">
      <div className={`rounded-md border p-4 ${s.recommended ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{s.name}</h3>
          {s.recommended ? <Badge tone="success">Recommended</Badge> : <Badge tone="neutral" icon={false}>Alternative</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-700">{s.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><DollarSign className="h-3.5 w-3.5" aria-hidden /> Added cost</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{fmtMoney(s.added_cost)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden /> Delivery impact</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{s.remaining_delay_days} d <span className="text-sm font-normal text-slate-500">supply delay</span></div>
          <div className="text-xs text-slate-500">{s.days_saved} days recovered · supply {fmtDate(s.supply_arrival_date)}</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Penalties avoided</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">{fmtMoney(s.penalties_avoided)}</div>
          <div className="text-xs text-slate-500">{fmtMoney(s.remaining_sla_penalties)} remaining</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Target className="h-3.5 w-3.5" aria-hidden /> Net benefit</div>
          <div className={`mt-1 text-lg font-semibold tabular-nums ${s.net_benefit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{s.net_benefit >= 0 ? '+' : '−'}{fmtMoney(Math.abs(s.net_benefit))}</div>
          <div className="text-xs text-slate-500">exposure {fmtMoney(s.total_exposure)} vs {fmtMoney(baseline.total_exposure)} baseline</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Why it {s.net_benefit >= 0 && s.key !== 'baseline' ? 'helps' : 'matters'}</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{s.explanation}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />{s.protected_commitments} of {s.affected_orders_count} affected commitments delivered on time{lateDelta > 0 ? ` (${lateDelta} fewer late than baseline)` : ''}.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />{fmtMoney(s.revenue_protected)} of revenue delivered on time; {fmtMoney(s.revenue_at_risk)} still at risk.</li>
            {s.units_reallocated > 0 && <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />{fmtNumber(s.units_reallocated)} units released from lower-priority reservations.</li>}
            {s.units_from_alternate > 0 && <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />{fmtNumber(s.units_from_alternate)} units sourced from the alternate supplier.</li>}
          </ul>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50/40 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> Remaining risks</h4>
          {s.risks.length === 0 ? (
            <p className="mt-1.5 text-sm text-slate-700">No residual risk flagged by the model under these assumptions.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5 text-sm text-slate-700">
              {s.risks.map((r) => (
                <li key={r} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" aria-hidden />{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Explanation is generated deterministically from the calculation results; no values are estimated by AI.</p>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Order-by-order outcome under this strategy</h4>
        <div className="overflow-hidden rounded-md border border-slate-200">
          <Table columns={columns} rows={impactOrders} rowKey={(o) => o.order_id} dense initialSort={{ key: 'penalty', dir: 'desc' }} caption="Order outcomes" emptyMessage="No orders are affected by this disruption." />
        </div>
      </div>
    </div>
  );
};
