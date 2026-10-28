import React from 'react';
import { RotateCcw } from 'lucide-react';
import { ScenarioAssumptionOverrides, ScenarioAssumptions } from '../../types/api';
import { Button } from '../ui/Button';

interface Props {
  resolved: ScenarioAssumptions | null;
  overrides: ScenarioAssumptionOverrides;
  onChange: (next: ScenarioAssumptionOverrides) => void;
  disabled?: boolean;
}

interface FieldDef {
  key: keyof ScenarioAssumptionOverrides;
  label: string;
  unit: string;
  hint: string;
  step?: number;
  min?: number;
  max?: number;
  group: 'Expedited shipment' | 'Alternate supplier' | 'Inventory reallocation';
}

const FIELDS: FieldDef[] = [
  { key: 'expedite_days_saved', label: 'Days recovered by expediting', unit: 'days', hint: 'Default: 60% of the simulated delay', step: 1, min: 0, max: 120, group: 'Expedited shipment' },
  { key: 'expedite_fixed_cost', label: 'Fixed expedite fee', unit: '$', hint: 'Charter / handling fee', step: 100, min: 0, group: 'Expedited shipment' },
  { key: 'expedite_cost_per_unit', label: 'Expedite surcharge per unit', unit: '$', hint: 'Default: 35% of unit cost, min $1.50', step: 0.5, min: 0, group: 'Expedited shipment' },
  { key: 'alternate_lead_time_days', label: 'Alternate supplier lead time', unit: 'days', hint: 'Default: qualified secondary source', step: 1, min: 0, max: 180, group: 'Alternate supplier' },
  { key: 'alternate_price_premium_pct', label: 'Price premium', unit: '%', hint: 'Over the standard unit cost', step: 5, min: 0, max: 500, group: 'Alternate supplier' },
  { key: 'alternate_coverage_pct', label: 'Share of shortage to source', unit: '%', hint: '100% covers every short unit', step: 10, min: 0, max: 100, group: 'Alternate supplier' },
  { key: 'reallocation_handling_cost_per_unit', label: 'Handling cost per unit moved', unit: '$', hint: 'Picking and re-kitting labour', step: 0.5, min: 0, group: 'Inventory reallocation' },
];

export const AssumptionsPanel: React.FC<Props> = ({ resolved, overrides, onChange, disabled }) => {
  const groups = Array.from(new Set(FIELDS.map((f) => f.group)));
  const changed = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Blank fields use defaults derived from supplier and material data. Every change re-runs all five strategies.</p>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => onChange({})} disabled={disabled || changed === 0}>
          Reset to defaults
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <fieldset key={g} className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-700">{g}</legend>
            <div className="space-y-3">
              {FIELDS.filter((f) => f.group === g).map((f) => {
                const value = overrides[f.key];
                const effective = resolved ? resolved[f.key] : undefined;
                const id = `assume-${f.key}`;
                return (
                  <div key={f.key}>
                    <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700">
                      {f.label}
                    </label>
                    <div className="relative">
                      <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        step={f.step}
                        min={f.min}
                        max={f.max}
                        disabled={disabled}
                        value={value === undefined ? '' : value}
                        placeholder={effective !== undefined ? String(effective) : ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = { ...overrides };
                          if (raw === '') delete next[f.key];
                          else {
                            const n = Number(raw);
                            if (!Number.isNaN(n)) next[f.key] = Math.max(f.min ?? -Infinity, f.max !== undefined ? Math.min(f.max, n) : n);
                          }
                          onChange(next);
                        }}
                        className={`h-9 w-full rounded-md border bg-white pl-3 pr-12 text-sm tabular-nums text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 ${value !== undefined ? 'border-sky-400' : 'border-slate-300'}`}
                        aria-describedby={`${id}-hint`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{f.unit}</span>
                    </div>
                    <p id={`${id}-hint`} className="mt-0.5 text-[11px] text-slate-500">
                      {value !== undefined ? 'Custom value' : f.hint}
                      {effective !== undefined && value === undefined ? ` · using ${effective}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
};
