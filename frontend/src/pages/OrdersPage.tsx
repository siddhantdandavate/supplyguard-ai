import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, SlidersHorizontal } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { OrderStatus } from '../types/api';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { ProductionOrder } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, riskTone, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput, Select } from '../components/ui/Inputs';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { KeyValueList } from '../components/ui/KeyValue';
import { fmtDate, fmtMoney, fmtNumber, relativeDays, titleCase } from '../lib/format';

const riskRank = { critical: 0, high: 1, medium: 2, low: 3 };

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useFetch(() => api.getOrders(), []);
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      const matchQ = !q || [o.order_number, o.product_name, o.customer?.name ?? '', ...o.materials_required.map((m) => m.material?.sku ?? '')].some((v) => v.toLowerCase().includes(q));
      return matchQ && (status === 'all' || o.status === status) && (risk === 'all' || o.risk_level === risk);
    });
  }, [data, search, status, risk]);

  const selected = id ? (data ?? []).find((o) => o.id === Number(id)) : undefined;

  const applyStatus = async () => {
    if (!selected || !pendingStatus) return;
    setSavingStatus(true);
    try {
      const updated = await api.updateOrderStatus(selected.id, pendingStatus);
      setData((data ?? []).map((o) => (o.id === updated.id ? updated : o)));
      toast.success('Order updated', `${updated.order_number} is now ${updated.status.replace('_', ' ')}.`);
      setPendingStatus(null);
      reload(true);
    } catch (err) {
      toast.error('Could not update order', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingStatus(false);
    }
  };

  const columns: Column<ProductionOrder>[] = [
    { key: 'order', header: 'Order ID', render: (o) => <span className="font-medium text-slate-900">{o.order_number}</span>, sortValue: (o) => o.order_number },
    { key: 'customer', header: 'Customer', render: (o) => (<span><span className="block text-slate-900">{o.customer?.name}</span><span className="block text-xs text-slate-500">{o.customer?.tier}</span></span>), sortValue: (o) => o.customer?.name ?? '' },
    { key: 'product', header: 'Product', render: (o) => o.product_name, sortValue: (o) => o.product_name },
    { key: 'materials', header: 'Required materials', render: (o) => (
      <span className="flex flex-wrap gap-1">
        {o.materials_required.map((m) => {
          const short = m.quantity_required - m.quantity_allocated;
          return (
            <span key={m.id} className={`rounded border px-1.5 py-0.5 text-[11px] ${short > 0 ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`} title={`${m.material?.name ?? ''}: ${m.quantity_allocated}/${m.quantity_required} allocated`}>
              {m.material?.sku ?? m.material_id}{short > 0 ? ` −${short}` : ''}
            </span>
          );
        })}
      </span>
    ) },
    { key: 'qty', header: 'Qty', render: (o) => <span className="tabular-nums">{fmtNumber(o.quantity)}</span>, sortValue: (o) => o.quantity, align: 'right' },
    { key: 'start', header: 'Planned start', render: (o) => fmtDate(o.planned_start_date), sortValue: (o) => o.planned_start_date },
    { key: 'due', header: 'Due', render: (o) => (<span><span className="block">{fmtDate(o.committed_delivery_date)}</span><span className="block text-xs text-slate-500">{relativeDays(o.committed_delivery_date)}</span></span>), sortValue: (o) => o.committed_delivery_date },
    { key: 'status', header: 'Status', render: (o) => <Badge tone={statusTone(o.status)}>{titleCase(o.status)}</Badge>, sortValue: (o) => o.status },
    { key: 'risk', header: 'Risk', render: (o) => (<span><Badge tone={riskTone(o.risk_level)}>{titleCase(o.risk_level)}</Badge>{o.late_days > 0 && <span className="block text-xs text-rose-600">{o.late_days} d late · {fmtMoney(o.sla_penalty)}</span>}</span>), sortValue: (o) => riskRank[o.risk_level] },
    { key: 'value', header: 'Value', render: (o) => <span className="tabular-nums">{fmtMoney(o.revenue_value)}</span>, sortValue: (o) => o.revenue_value, align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Production Orders" description="Work orders with their bill of materials, schedule and computed risk from active supplier disruptions." />

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search order, product, customer, SKU…" className="md:w-80" aria-label="Search orders" />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="o-status" className="text-xs text-slate-500">Status</label>
            <Select id="o-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="all">All</option>
              <option value="delayed">Delayed</option>
              <option value="in_progress">In progress</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </Select>
            <label htmlFor="o-risk" className="text-xs text-slate-500">Risk</label>
            <Select id="o-risk" value={risk} onChange={(e) => setRisk(e.target.value)} className="w-36">
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>
        <DataState loading={loading} error={error} onRetry={() => reload()} isEmpty={(data ?? []).length === 0} empty={<EmptyState icon={ClipboardList} title="No production orders" />}>
          <Table columns={columns} rows={rows} rowKey={(o) => o.id} onRowClick={(o) => navigate(`/orders/${o.id}`)} initialSort={{ key: 'risk', dir: 'asc' }} caption="Production orders" emptyMessage={<EmptyState title="No matches" description="Try a different search or clear the filters." />} />
        </DataState>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Showing {rows.length} of {data?.length ?? 0}</div>
      </Card>

      <Modal open={!!id} onClose={() => navigate('/orders')} title={selected ? `${selected.order_number} · ${selected.product_name}` : 'Order'} size="xl"
        footer={selected?.blocking_disruption_id ? (
          <>
            <Button variant="secondary" onClick={() => navigate(`/disruptions/${selected.blocking_disruption_id}`)}>View disruption</Button>
            <Button icon={SlidersHorizontal} onClick={() => navigate(`/war-room/${selected.blocking_disruption_id}`)}>Open War Room</Button>
          </>
        ) : <Button variant="secondary" onClick={() => navigate('/orders')}>Close</Button>}>
        {!selected && !loading && <EmptyState title="Order not found" />}
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(selected.status)}>{titleCase(selected.status)}</Badge>
                <Badge tone={riskTone(selected.risk_level)}>Risk: {titleCase(selected.risk_level)}</Badge>
                <Badge tone={riskTone(selected.priority)} icon={false}>Priority: {titleCase(selected.priority)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="order-status" className="text-xs text-slate-500">Change status</label>
                <Select id="order-status" value={selected.status} onChange={(e) => setPendingStatus(e.target.value as OrderStatus)} className="w-40">
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In progress</option>
                  <option value="delayed">Delayed</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
            </div>
            <KeyValueList
              columns={4}
              items={[
                { label: 'Customer', value: <Link to={`/customers/${selected.customer_id}`} className="text-sky-700 hover:underline">{selected.customer?.name}</Link> },
                { label: 'Tier', value: selected.customer?.tier ?? '—' },
                { label: 'Quantity', value: fmtNumber(selected.quantity) },
                { label: 'Order value', value: fmtMoney(selected.revenue_value) },
                { label: 'Planned start', value: fmtDate(selected.planned_start_date) },
                { label: 'Planned completion', value: fmtDate(selected.planned_completion_date) },
                { label: 'Committed delivery', value: `${fmtDate(selected.committed_delivery_date)} (${relativeDays(selected.committed_delivery_date)})` },
                { label: 'Projected completion', value: fmtDate(selected.projected_completion_date), tone: selected.late_days > 0 ? 'critical' : 'success' },
                { label: 'SLA penalty / day', value: fmtMoney(selected.customer?.sla_penalty_per_day) },
                { label: 'Projected penalty', value: fmtMoney(selected.sla_penalty), tone: selected.sla_penalty > 0 ? 'critical' : 'muted' },
                { label: 'Blocked by', value: selected.blocking_po_number ? <Link to={`/disruptions/${selected.blocking_disruption_id}`} className="text-sky-700 hover:underline">{selected.blocking_po_number} · {selected.blocking_material}</Link> : 'Nothing', tone: selected.blocking_po_number ? 'warning' : 'muted' },
                { label: 'Late days', value: selected.late_days > 0 ? `${selected.late_days}` : '0', tone: selected.late_days > 0 ? 'critical' : 'success' },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Bill of materials</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">SKU</th><th className="px-3 py-2">Material</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2 text-right">Required</th><th className="px-3 py-2 text-right">Allocated</th><th className="px-3 py-2 text-right">Short</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.materials_required.map((m) => {
                      const short = m.quantity_required - m.quantity_allocated;
                      return (
                        <tr key={m.id}>
                          <td className="px-3 py-2 font-medium text-slate-900">{m.material?.sku}</td>
                          <td className="px-3 py-2 text-slate-700">{m.material?.name}</td>
                          <td className="px-3 py-2 text-slate-600">{m.material?.supplier?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(m.quantity_required)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(m.quantity_allocated)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${short > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{short > 0 ? fmtNumber(short) : '0'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Change order status"
        message={<>Set <span className="font-medium">{selected?.order_number}</span> to <span className="font-medium">{pendingStatus?.replace('_', ' ')}</span>? Completed orders drop out of shortage and risk calculations.</>}
        confirmLabel="Update status"
        onConfirm={applyStatus}
        onCancel={() => setPendingStatus(null)}
        busy={savingStatus}
      />
    </div>
  );
};
