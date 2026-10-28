import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Boxes, CheckCircle2, ClipboardList, DollarSign, History, SlidersHorizontal, Truck, Users } from 'lucide-react';
import { DecisionLog } from '../components/warroom/DecisionLog';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { DisruptionStatus, OrderOutcome } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, riskTone, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { KeyValueList } from '../components/ui/KeyValue';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Inputs';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtMoney, fmtNumber, fmtPct, relativeDays, titleCase } from '../lib/format';

export const DisruptionDetailPage: React.FC = () => {
  const { id } = useParams();
  const delayId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.getDisruptionDetail(delayId), [delayId]);
  const [pendingStatus, setPendingStatus] = useState<DisruptionStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const commitments = useMemo(() => {
    const byCustomer = new Map<string, { name: string; tier: string; orders: OrderOutcome[]; penalty: number; revenue: number; late: number }>();
    for (const o of data?.affected_orders ?? []) {
      const key = o.customer_name;
      const entry = byCustomer.get(key) ?? { name: o.customer_name, tier: o.customer_tier, orders: [], penalty: 0, revenue: 0, late: 0 };
      entry.orders.push(o);
      entry.penalty += o.sla_penalty;
      entry.revenue += o.revenue_value;
      if (o.is_late) entry.late += 1;
      byCustomer.set(key, entry);
    }
    return [...byCustomer.values()].sort((a, b) => b.penalty - a.penalty);
  }, [data]);

  const changeStatus = async () => {
    if (!pendingStatus) return;
    setSaving(true);
    try {
      await api.updateDisruptionStatus(delayId, pendingStatus);
      toast.success('Status updated', `${data?.disruption.po_number} is now ${pendingStatus}.`);
      setPendingStatus(null);
      reload(true);
    } catch (err) {
      toast.error('Could not update status', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const orderColumns: Column<OrderOutcome>[] = [
    { key: 'order', header: 'Order', render: (o) => <Link to={`/orders/${o.order_id}`} className="font-medium text-sky-700 hover:underline" onClick={(e) => e.stopPropagation()}>{o.order_number}</Link>, sortValue: (o) => o.order_number },
    { key: 'customer', header: 'Customer', render: (o) => (<span><span className="block text-slate-900">{o.customer_name}</span><span className="block text-xs text-slate-500">{o.customer_tier}</span></span>), sortValue: (o) => o.customer_name },
    { key: 'product', header: 'Product', render: (o) => o.product_name },
    { key: 'need', header: 'Required / allocated', render: (o) => <span className="tabular-nums">{fmtNumber(o.quantity_required)} / {fmtNumber(o.quantity_allocated)}</span>, align: 'right' },
    { key: 'short', header: 'Short', render: (o) => <span className={`tabular-nums ${o.unfilled_after_pool > 0 ? 'font-medium text-rose-700' : 'text-emerald-700'}`}>{fmtNumber(o.unfilled_after_pool)}</span>, sortValue: (o) => o.unfilled_after_pool, align: 'right' },
    { key: 'committed', header: 'Committed', render: (o) => fmtDate(o.committed_delivery_date), sortValue: (o) => o.committed_delivery_date },
    { key: 'projected', header: 'Projected finish', render: (o) => <span className={o.is_late ? 'text-rose-700' : 'text-emerald-700'}>{fmtDate(o.projected_completion_date)}</span>, sortValue: (o) => o.projected_completion_date },
    { key: 'late', header: 'Outcome', render: (o) => o.is_late ? <Badge tone="critical">{o.late_days} days late</Badge> : <Badge tone="success">On time</Badge>, sortValue: (o) => o.late_days },
    { key: 'penalty', header: 'SLA penalty', render: (o) => <span className={o.sla_penalty > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}>{fmtMoney(o.sla_penalty)}</span>, sortValue: (o) => o.sla_penalty, align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <DataState loading={loading && !data} error={error} onRetry={() => reload()} loadingRows={8}>
        {data && (
          <>
            <PageHeader
              crumbs={[{ label: 'Disruptions', to: '/disruptions' }, { label: data.disruption.po_number }]}
              title={`${data.disruption.po_number} · ${data.disruption.material?.name ?? data.summary.material_name}`}
              badge={
                <>
                  <Badge tone={riskTone(data.disruption.impact_severity)}>{titleCase(data.disruption.impact_severity)}</Badge>
                  <Badge tone={statusTone(data.disruption.status)}>{titleCase(data.disruption.status)}</Badge>
                </>
              }
              description={data.disruption.reason ?? 'Supplier shipment delay'}
              actions={
                <>
                  <div className="flex items-center gap-2">
                    <label htmlFor="status" className="text-xs text-slate-500">Status</label>
                    <Select id="status" value={data.disruption.status} onChange={(e) => setPendingStatus(e.target.value as DisruptionStatus)} className="w-36">
                      <option value="active">Active</option>
                      <option value="mitigated">Mitigated</option>
                      <option value="resolved">Resolved</option>
                    </Select>
                  </div>
                  <Button icon={SlidersHorizontal} onClick={() => navigate(`/war-room/${delayId}`)}>
                    Open What-If War Room
                  </Button>
                </>
              }
            />

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { label: 'Delay', value: `+${data.disruption.delay_days} days`, tone: 'text-rose-700' },
                { label: 'Units short', value: fmtNumber(data.summary.shortage_units), tone: data.summary.shortage_units > 0 ? 'text-rose-700' : 'text-emerald-700' },
                { label: 'Orders late', value: `${data.summary.late_orders_count} of ${data.summary.affected_orders_count}`, tone: data.summary.late_orders_count > 0 ? 'text-rose-700' : 'text-emerald-700' },
                { label: 'SLA penalty exposure', value: fmtMoney(data.summary.sla_penalty_exposure), tone: data.summary.sla_penalty_exposure > 0 ? 'text-rose-700' : 'text-slate-900' },
                { label: 'Revenue at risk', value: fmtMoney(data.summary.revenue_at_risk), tone: data.summary.revenue_at_risk > 0 ? 'text-amber-700' : 'text-slate-900' },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
                  <div className="text-xs text-slate-500">{k.label}</div>
                  <div className={`mt-1 text-xl font-semibold tabular-nums ${k.tone}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Truck className="h-4 w-4 text-slate-500" aria-hidden /> Shipment & supplier</span>}>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: 'Supplier', value: <Link to={`/suppliers/${data.disruption.supplier_id}`} className="text-sky-700 hover:underline">{data.disruption.supplier?.name}</Link> },
                    { label: 'Supplier code', value: data.disruption.supplier?.code ?? '—' },
                    { label: 'Quantity in shipment', value: `${fmtNumber(data.disruption.quantity_delayed)} ${data.disruption.material?.unit_of_measure ?? ''}` },
                    { label: 'Standard lead time', value: `${data.disruption.supplier?.lead_time_days ?? '—'} days` },
                    { label: 'Original ETA', value: fmtDate(data.disruption.original_eta), tone: 'muted' },
                    { label: 'Revised ETA', value: `${fmtDate(data.disruption.revised_eta)} (${relativeDays(data.disruption.revised_eta)})`, tone: 'critical' },
                    { label: 'On-time rate', value: fmtPct(data.disruption.supplier?.on_time_delivery_rate) },
                    { label: 'Reliability', value: data.disruption.supplier ? `${data.disruption.supplier.reliability_score.toFixed(1)} / 10` : '—' },
                  ]}
                />
              </Card>

              <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Boxes className="h-4 w-4 text-slate-500" aria-hidden /> Material & inventory</span>}>
                {data.inventory ? (
                  <>
                    <KeyValueList
                      columns={2}
                      items={[
                        { label: 'SKU', value: data.disruption.material?.sku ?? '—' },
                        { label: 'Unit cost', value: fmtMoney(data.disruption.material?.unit_cost) },
                        { label: 'On hand', value: fmtNumber(data.inventory.current_stock) },
                        { label: 'Reserved', value: fmtNumber(data.inventory.reserved_stock), tone: 'warning' },
                        { label: 'Available (free)', value: fmtNumber(data.inventory.available_stock), tone: data.inventory.available_stock <= 0 ? 'critical' : 'success' },
                        { label: 'Reorder point', value: fmtNumber(data.inventory.reorder_point), tone: 'muted' },
                        { label: 'Location', value: data.inventory.location },
                        { label: 'Stock status', value: <Badge tone={statusTone(data.inventory.stock_status)}>{titleCase(data.inventory.stock_status)}</Badge> },
                      ]}
                    />
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-800">Shortage calculation</div>
                      <div className="mt-1 tabular-nums">
                        Unfilled demand {fmtNumber(data.baseline.orders.filter((o) => o.unfilled_before > 0).reduce((s, o) => s + o.unfilled_before, 0))} − free stock {fmtNumber(data.inventory.available_stock)} = <span className="font-semibold text-rose-700">{fmtNumber(data.summary.shortage_units)} units short</span>
                      </div>
                      <div className="mt-1 text-slate-500">Free stock is allocated to orders by customer priority, then committed date.</div>
                    </div>
                  </>
                ) : (
                  <EmptyState title="No inventory record" description="This material has no inventory row yet." />
                )}
              </Card>

              <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><DollarSign className="h-4 w-4 text-slate-500" aria-hidden /> Estimated financial impact</span>}>
                <KeyValueList
                  columns={1}
                  items={[
                    { label: 'SLA penalties if nothing is done', value: fmtMoney(data.baseline.remaining_sla_penalties), tone: data.baseline.remaining_sla_penalties > 0 ? 'critical' : 'success' },
                    { label: 'Revenue on late orders', value: fmtMoney(data.baseline.revenue_at_risk), tone: 'warning' },
                    { label: 'Customers affected', value: `${data.summary.customers_at_risk}` },
                    { label: 'Recommended recovery', value: data.recommended.key === 'baseline' ? 'Accept the delay' : data.recommended.name, tone: 'success' },
                    { label: 'Adopted plan', value: data.summary.adopted_strategy ?? 'None yet', tone: data.summary.adopted_strategy ? 'success' : 'muted' },
                    { label: 'Recommended plan cost', value: fmtMoney(data.recommended.added_cost) },
                    { label: 'Penalties avoided by recommendation', value: fmtMoney(data.recommended.penalties_avoided), tone: 'success' },
                  ]}
                />
              </Card>
            </div>

            <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ClipboardList className="h-4 w-4 text-slate-500" aria-hidden /> Affected production orders</span>} subtitle="Orders that need this material and are not fully allocated. Projection assumes no intervention." bodyClassName="p-0">
              <Table columns={orderColumns} rows={data.affected_orders} rowKey={(o) => o.order_id} onRowClick={(o) => navigate(`/orders/${o.order_id}`)} initialSort={{ key: 'penalty', dir: 'desc' }} caption="Affected production orders" emptyMessage={<EmptyState icon={CheckCircle2} title="No orders affected" description="Every order using this material is fully allocated." />} />
            </Card>

            <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-slate-500" aria-hidden /> Customer commitments at risk</span>}>
              {commitments.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No commitments at risk" />
              ) : (
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {commitments.map((c) => (
                    <li key={c.name} className={`rounded-md border p-3 ${c.late > 0 ? 'border-rose-200 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.tier}</div>
                        </div>
                        {c.late > 0 ? <Badge tone="critical">{c.late} late</Badge> : <Badge tone="success">Protected</Badge>}
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500">Orders</dt><dd className="font-medium text-slate-800">{c.orders.map((o) => o.order_number).join(', ')}</dd></div>
                        <div><dt className="text-slate-500">Revenue</dt><dd className="font-medium text-slate-800">{fmtMoney(c.revenue)}</dd></div>
                        <div><dt className="text-slate-500">SLA penalty</dt><dd className={`font-medium ${c.penalty > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{fmtMoney(c.penalty)}</dd></div>
                        <div><dt className="text-slate-500">Earliest due</dt><dd className="font-medium text-slate-800">{fmtDate([...c.orders].sort((a, b) => a.committed_delivery_date.localeCompare(b.committed_delivery_date))[0]?.committed_delivery_date)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><History className="h-4 w-4 text-slate-500" aria-hidden /> Recovery decisions</span>} subtitle="Plans adopted for this disruption, newest first" bodyClassName="p-0">
              <DecisionLog decisions={data.decisions} />
            </Card>

            <section className="flex flex-col gap-4 rounded-lg border border-sky-200 bg-white p-5 shadow-card md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">Next step</div>
                <h2 className="mt-0.5 text-base font-semibold text-slate-900">Compare recovery strategies in the What-If War Room</h2>
                <p className="mt-1 text-sm text-slate-600">{data.scenario_summary}</p>
              </div>
              <Button size="lg" icon={SlidersHorizontal} onClick={() => navigate(`/war-room/${delayId}`)}>
                Open What-If War Room
              </Button>
            </section>

            {data.disruption.status !== 'active' && (
              <Alert kind="info">This disruption is marked {data.disruption.status}. Impact figures are still computed from the current order and inventory data.</Alert>
            )}
          </>
        )}
      </DataState>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Change disruption status"
        message={<>Mark <span className="font-medium">{data?.disruption.po_number}</span> as <span className="font-medium">{pendingStatus}</span>? Active disruptions drive the dashboard risk figures; mitigated and resolved ones do not.</>}
        confirmLabel="Update status"
        onConfirm={changeStatus}
        onCancel={() => setPendingStatus(null)}
        busy={saving}
      />
    </div>
  );
};
