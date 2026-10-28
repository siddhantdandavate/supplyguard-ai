import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList } from 'recharts';
import { StrategyOutcome } from '../../types/api';
import { fmtMoney } from '../../lib/format';

const SHORT: Record<string, string> = { baseline: 'Baseline', expedite: 'Expedite', alternate: 'Alt. supplier', reallocation: 'Reallocate', combined: 'Combined' };

const COLORS = {
  cost: '#0369a1', // sky-700
  penalties: '#e11d48', // rose-600
  delay: '#d97706', // amber-600
  late: '#be123c', // rose-700
  protectedC: '#059669', // emerald-600
  grid: '#e2e8f0',
  axis: '#64748b',
};

interface TooltipPayload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

const MoneyTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />{p.name}</span>
          <span className="tabular-nums text-slate-900">{fmtMoney(p.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-100 pt-1 font-semibold">
        <span className="text-slate-700">Total exposure</span>
        <span className="tabular-nums text-slate-900">{fmtMoney(total)}</span>
      </div>
    </div>
  );
};

const CountTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />{p.name}</span>
          <span className="tabular-nums text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  strategies: StrategyOutcome[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export const ExposureChart: React.FC<Props> = ({ strategies, selectedKey, onSelect }) => {
  const data = strategies.map((s) => ({ key: s.key, name: SHORT[s.key] ?? s.name, cost: s.added_cost, penalties: s.remaining_sla_penalties, recommended: s.recommended }));
  const baseline = strategies.find((s) => s.key === 'baseline');
  return (
    <div className="h-72 w-full" role="img" aria-label="Stacked bar chart of added recovery cost and remaining SLA penalties per strategy">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }} barCategoryGap={28}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="name" tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} width={52} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={10} />
          {baseline && <ReferenceLine y={baseline.total_exposure} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Baseline exposure', position: 'insideTopRight', fill: '#64748b', fontSize: 11 }} />}
          <Bar dataKey="cost" name="Added recovery cost" stackId="a" fill={COLORS.cost} onClick={(d: { key?: string }) => d?.key && onSelect(d.key)} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={d.key === selectedKey ? 1 : 0.55} />
            ))}
          </Bar>
          <Bar dataKey="penalties" name="Remaining SLA penalties" stackId="a" fill={COLORS.penalties} radius={[3, 3, 0, 0]} onClick={(d: { key?: string }) => d?.key && onSelect(d.key)} cursor="pointer">
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={d.key === selectedKey ? 1 : 0.55} />
            ))}
            <LabelList dataKey="recommended" position="top" content={(props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) => {
              if (!props.value) return null;
              const x = Number(props.x) + Number(props.width) / 2;
              const y = Number(props.y) - 6;
              return (
                <text x={x} y={y} textAnchor="middle" fontSize={11} fontWeight={600} fill="#047857">
                  ★ Recommended
                </text>
              );
            }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const DeliveryChart: React.FC<Props> = ({ strategies, selectedKey, onSelect }) => {
  const data = strategies.map((s) => ({ key: s.key, name: SHORT[s.key] ?? s.name, delay: s.remaining_delay_days, late: s.late_orders_count, protectedC: s.protected_commitments }));
  return (
    <div className="h-72 w-full" role="img" aria-label="Grouped bar chart of remaining delay days, late orders and protected commitments per strategy">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }} barCategoryGap={22} barGap={3}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} />
          <XAxis dataKey="name" tick={{ fill: COLORS.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="days" tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} label={{ value: 'days', angle: -90, position: 'insideLeft', fill: COLORS.axis, fontSize: 11 }} />
          <YAxis yAxisId="count" orientation="right" tick={{ fill: COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} label={{ value: 'orders', angle: 90, position: 'insideRight', fill: COLORS.axis, fontSize: 11 }} />
          <Tooltip content={<CountTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={10} />
          <Bar yAxisId="days" dataKey="delay" name="Remaining supply delay (days)" fill={COLORS.delay} radius={[3, 3, 0, 0]} onClick={(d: { key?: string }) => d?.key && onSelect(d.key)} cursor="pointer">
            {data.map((d) => <Cell key={d.key} fillOpacity={d.key === selectedKey ? 1 : 0.55} />)}
          </Bar>
          <Bar yAxisId="count" dataKey="late" name="Orders finishing late" fill={COLORS.late} radius={[3, 3, 0, 0]} onClick={(d: { key?: string }) => d?.key && onSelect(d.key)} cursor="pointer">
            {data.map((d) => <Cell key={d.key} fillOpacity={d.key === selectedKey ? 1 : 0.55} />)}
          </Bar>
          <Bar yAxisId="count" dataKey="protectedC" name="Commitments protected" fill={COLORS.protectedC} radius={[3, 3, 0, 0]} onClick={(d: { key?: string }) => d?.key && onSelect(d.key)} cursor="pointer">
            {data.map((d) => <Cell key={d.key} fillOpacity={d.key === selectedKey ? 1 : 0.55} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
