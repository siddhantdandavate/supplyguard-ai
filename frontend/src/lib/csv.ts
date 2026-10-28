import { ScenarioResponse } from '../types/api';

function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function scenarioToCsv(r: ScenarioResponse): string {
  const metrics: Array<[string, (k: number) => unknown]> = [
    ['Added recovery cost ($)', (i) => r.strategies[i].added_cost],
    ['Remaining supply delay (days)', (i) => r.strategies[i].remaining_delay_days],
    ['Days recovered', (i) => r.strategies[i].days_saved],
    ['Supply arrival date', (i) => r.strategies[i].supply_arrival_date],
    ['Material shortage after free stock (units)', (i) => r.strategies[i].shortage_units_immediate],
    ['Affected production orders', (i) => r.strategies[i].affected_orders_count],
    ['Orders finishing late', (i) => r.strategies[i].late_orders_count],
    ['Protected customer commitments', (i) => r.strategies[i].protected_commitments],
    ['Remaining SLA penalties ($)', (i) => r.strategies[i].remaining_sla_penalties],
    ['SLA penalties avoided ($)', (i) => r.strategies[i].penalties_avoided],
    ['Revenue still at risk ($)', (i) => r.strategies[i].revenue_at_risk],
    ['Total exposure ($)', (i) => r.strategies[i].total_exposure],
    ['Net benefit vs baseline ($)', (i) => r.strategies[i].net_benefit],
    ['Recommended', (i) => (r.strategies[i].recommended ? 'yes' : 'no')],
  ];
  const lines: string[] = [];
  lines.push(['SupplyGuard AI scenario comparison'].map(cell).join(','));
  lines.push(['Disruption', r.po_number, 'Material', r.material_name, 'Supplier', r.supplier_name].map(cell).join(','));
  lines.push(['Simulated delay (days)', r.simulated_delay_days, 'Revised ETA', r.revised_eta, 'Free stock', r.free_stock, 'Unfilled demand', r.total_unfilled_demand].map(cell).join(','));
  lines.push('');
  lines.push(['Metric', ...r.strategies.map((s) => s.name)].map(cell).join(','));
  for (const [label, fn] of metrics) lines.push([label, ...r.strategies.map((_, i) => fn(i))].map(cell).join(','));
  lines.push('');
  lines.push(['Assumption', 'Value'].map(cell).join(','));
  for (const [k, v] of Object.entries(r.assumptions)) lines.push([k, v].map(cell).join(','));
  lines.push('');
  lines.push(['Strategy', 'Order', 'Customer', 'Short after stock', 'Covered by supply', 'Committed', 'Projected finish', 'Late days', 'SLA penalty ($)'].map(cell).join(','));
  for (const s of r.strategies) {
    for (const o of s.orders.filter((x) => x.unfilled_before > 0 || x.role === 'donor')) {
      lines.push([s.name, o.order_number, o.customer_name, o.unfilled_after_pool, o.cover_date ?? 'from stock', o.committed_delivery_date, o.projected_completion_date, o.late_days, o.sla_penalty].map(cell).join(','));
    }
  }
  return lines.join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
