import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'critical' | 'warning' | 'success' | 'accent';
  to?: string;
}

const tones = {
  default: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  critical: { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-700' },
  warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
  success: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
  accent: { icon: 'bg-sky-50 text-sky-700', value: 'text-sky-800' },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, tone = 'default', to }) => {
  const t = tones[tone];
  const body = (
    <>
      <div className="flex items-start justify-between">
        <div className={`rounded-md p-2 ${t.icon}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        {to && <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" aria-hidden />}
      </div>
      <div className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${t.value}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-600">{label}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </>
  );
  const cls = 'group block rounded-lg border border-slate-200 bg-white p-4 shadow-card transition-colors';
  return to ? (
    <Link to={to} className={`${cls} hover:border-slate-300 hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};
