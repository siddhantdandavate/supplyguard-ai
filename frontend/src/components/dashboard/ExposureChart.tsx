import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DisruptionSummary } from '../../types/api';
import { fmtMoney } from '../../lib/format';

const colors: Record<string, string> = { critical: '#e11d48', high: '#d97706', medium: '#ca8a04' };

interface TipPayload {
  payload?: { po: string; material: string; exposure: number; recoverable: number; late: number };
}

const Tip = ({ active, payload }: { active?: boolean; payload?: TipPayload[] }) => {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">{p.po}</div>
      <div className="text-slate-500">{p.material}</div>
      <div className="mt-1 flex justify-between gap-4"><span className="text-slate-600">Penalty exposure</span><span className="tabular-nums text-slate-900">{fmtMoney(p.exposure)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-600">Recoverable</span><span className="tabular-nums text-emerald-700">{fmtMoney(p.recoverable)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-600">Late orders</span><span className="tabular-nums text-slate-900">{p.late}</span></div>
    </div>
  );
};

export const ExposureByDisruptionChart: React.FC<{ disruptions: DisruptionSummary[] }> = ({ disruptions }) => {
  const navigate = useNavigate();
  const data = disruptions
    .filter((d) => d.status === 'active')
    .map((d) => ({ id: d.id, po: d.po_number, material: d.material_name, exposure: d.sla_penalty_exposure, recoverable: d.recommended_penalties_avoided ?? 0, late: d.late_orders_count, severity: d.impact_severity }))
    .sort((a, b) => b.exposure - a.exposure);
  if (data.length === 0) return <p className="text-sm text-slate-500">No active disruptions.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label="Bar chart of SLA penalty exposure per active disruption">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap={12}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} />
          <YAxis type="category" dataKey="po" width={72} tick={{ fill: '#334155', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="exposure" name="SLA penalty exposure" radius={[0, 3, 3, 0]} cursor="pointer" onClick={(d: { id?: number }) => d?.id && navigate(`/disruptions/${d.id}`)}>
            {data.map((d) => <Cell key={d.id} fill={colors[d.severity] ?? '#64748b'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
