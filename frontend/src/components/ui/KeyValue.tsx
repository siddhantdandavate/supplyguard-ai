import React from 'react';

export interface KV {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'critical' | 'warning' | 'success' | 'muted';
}

const tones = {
  default: 'text-slate-900',
  critical: 'text-rose-700',
  warning: 'text-amber-700',
  success: 'text-emerald-700',
  muted: 'text-slate-500',
};

export const KeyValueList: React.FC<{ items: KV[]; columns?: 1 | 2 | 3 | 4; className?: string }> = ({ items, columns = 2, className = '' }) => {
  const cols = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${cols} ${className}`}>
      {items.map((kv) => (
        <div key={kv.label} className="min-w-0">
          <dt className="text-xs text-slate-500">{kv.label}</dt>
          <dd className={`mt-0.5 text-sm font-medium ${tones[kv.tone ?? 'default']}`}>{kv.value}</dd>
        </div>
      ))}
    </dl>
  );
};
