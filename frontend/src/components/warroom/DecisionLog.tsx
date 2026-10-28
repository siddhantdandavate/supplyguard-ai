import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, History, User } from 'lucide-react';
import { RecoveryDecision } from '../../types/api';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/States';
import { fmtDateTime, fmtMoney } from '../../lib/format';

interface Props {
  decisions: RecoveryDecision[];
  showDisruption?: boolean;
  compact?: boolean;
}

export const DecisionLog: React.FC<Props> = ({ decisions, showDisruption = false, compact = false }) => {
  if (decisions.length === 0) {
    return <EmptyState icon={History} title="No decisions recorded" description="Plans adopted in the What-If War Room appear here with who adopted them and the expected outcome." className="py-8" />;
  }
  return (
    <ol className="divide-y divide-slate-100">
      {decisions.map((d) => (
        <li key={d.id} className={`${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{d.strategy_name}</span>
                {d.status === 'adopted' ? <Badge tone="success">Adopted</Badge> : <Badge tone="neutral" icon={false}>Superseded</Badge>}
                {showDisruption && (
                  <Link to={`/disruptions/${d.shipment_delay_id}`} className="text-xs text-sky-700 hover:underline">
                    {d.po_number} · {d.material_name}
                  </Link>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden />{d.decided_by_name ?? 'Unknown'}</span>
                <span>{fmtDateTime(d.decided_at)}</span>
                <span>Simulated delay {d.simulated_delay_days} d</span>
              </div>
            </div>
            <dl className="flex gap-4 text-xs">
              <div><dt className="text-slate-500">Cost</dt><dd className="font-medium tabular-nums text-slate-900">{fmtMoney(d.added_cost)}</dd></div>
              <div><dt className="text-slate-500">Avoided</dt><dd className="font-medium tabular-nums text-emerald-700">{fmtMoney(d.penalties_avoided)}</dd></div>
              <div><dt className="text-slate-500">Net</dt><dd className={`font-medium tabular-nums ${d.net_benefit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{d.net_benefit >= 0 ? '+' : '−'}{fmtMoney(Math.abs(d.net_benefit))}</dd></div>
              <div><dt className="text-slate-500">Late</dt><dd className="font-medium tabular-nums text-slate-900">{d.late_orders_count}</dd></div>
            </dl>
          </div>
          {!compact && d.summary && <p className="mt-2 text-sm text-slate-700">{d.summary}</p>}
          {d.note && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden />
              <span><span className="font-medium">Note:</span> {d.note}</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};
