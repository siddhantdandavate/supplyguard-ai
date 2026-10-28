import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Phone, Plus, Users } from 'lucide-react';
import { CustomerFormModal } from '../components/forms/PartnerFormModals';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { CustomerDetail } from '../types/api';
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

const tierTone = (tier: string) => (tier.startsWith('Tier 1') ? 'critical' : tier.startsWith('Tier 2') ? 'info' : 'neutral');

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => api.getCustomers(), []);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const tiers = useMemo(() => Array.from(new Set((data ?? []).map((c) => c.tier))).sort(), [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => (!q || [c.name, c.code, c.tier, c.contact_name ?? ''].some((v) => v.toLowerCase().includes(q))) && (tier === 'all' || c.tier === tier));
  }, [data, search, tier]);

  const selected = id ? (data ?? []).find((c) => c.id === Number(id)) : undefined;

  const columns: Column<CustomerDetail>[] = [
    { key: 'code', header: 'Code', render: (c) => <span className="font-medium text-slate-900">{c.code}</span>, sortValue: (c) => c.code },
    { key: 'name', header: 'Customer', render: (c) => (<span><span className="block text-slate-900">{c.name}</span><span className="block text-xs text-slate-500">{c.contact_name ?? ''}</span></span>), sortValue: (c) => c.name },
    { key: 'tier', header: 'Tier', render: (c) => <Badge tone={tierTone(c.tier)} icon={false}>{c.tier}</Badge>, sortValue: (c) => c.tier },
    { key: 'priority', header: 'Priority', render: (c) => <span className="tabular-nums">{c.priority_score} / 100</span>, sortValue: (c) => c.priority_score, align: 'right' },
    { key: 'sla', header: 'SLA penalty / day', render: (c) => <span className="tabular-nums">{fmtMoney(c.sla_penalty_per_day)}</span>, sortValue: (c) => c.sla_penalty_per_day, align: 'right' },
    { key: 'orders', header: 'Open orders', render: (c) => <span className="tabular-nums">{c.active_order_count}</span>, sortValue: (c) => c.active_order_count, align: 'right' },
    { key: 'risk', header: 'Orders at risk', render: (c) => <span className={`tabular-nums font-medium ${c.orders_at_risk > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{c.orders_at_risk}</span>, sortValue: (c) => c.orders_at_risk, align: 'right' },
    { key: 'exposure', header: 'Penalty exposure', render: (c) => <span className={`tabular-nums ${c.penalty_exposure > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}`}>{fmtMoney(c.penalty_exposure)}</span>, sortValue: (c) => c.penalty_exposure, align: 'right' },
    { key: 'next', header: 'Next commitment', render: (c) => c.next_commitment_date ? (<span><span className="block">{fmtDate(c.next_commitment_date)}</span><span className="block text-xs text-slate-500">{relativeDays(c.next_commitment_date)}</span></span>) : <span className="text-slate-400">—</span>, sortValue: (c) => c.next_commitment_date ?? '' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Account tiers, SLA penalty terms and the production orders committed to each customer." actions={<Button icon={Plus} onClick={() => setAddOpen(true)}>Add customer</Button>} />
      <CustomerFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); reload(true); }} />
      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customer, code, tier, contact…" className="md:w-80" aria-label="Search customers" />
          <div className="flex items-center gap-2">
            <label htmlFor="tier" className="text-xs text-slate-500">Tier</label>
            <Select id="tier" value={tier} onChange={(e) => setTier(e.target.value)} className="w-48">
              <option value="all">All tiers</option>
              {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <DataState loading={loading} error={error} onRetry={() => reload()} isEmpty={(data ?? []).length === 0} empty={<EmptyState icon={Users} title="No customers" />}>
          <Table columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/customers/${c.id}`)} initialSort={{ key: 'exposure', dir: 'desc' }} caption="Customers" emptyMessage={<EmptyState title="No matches" />} />
        </DataState>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Showing {rows.length} of {data?.length ?? 0}</div>
      </Card>

      <Modal open={!!id} onClose={() => navigate('/customers')} title={selected?.name ?? 'Customer'} description={selected?.code} size="xl" footer={<Button variant="secondary" onClick={() => navigate('/customers')}>Close</Button>}>
        {!selected && !loading && <EmptyState title="Customer not found" />}
        {selected && (
          <div className="space-y-5">
            <KeyValueList
              columns={4}
              items={[
                { label: 'Tier', value: <Badge tone={tierTone(selected.tier)} icon={false}>{selected.tier}</Badge> },
                { label: 'Priority score', value: `${selected.priority_score} / 100` },
                { label: 'SLA penalty per late day', value: fmtMoney(selected.sla_penalty_per_day), tone: 'warning' },
                { label: 'Projected penalty exposure', value: fmtMoney(selected.penalty_exposure), tone: selected.penalty_exposure > 0 ? 'critical' : 'success' },
                { label: 'Contact', value: selected.contact_name ?? '—' },
                { label: 'Email', value: selected.email ? <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden />{selected.email}</a> : '—' },
                { label: 'Phone', value: selected.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />{selected.phone}</span> : '—' },
                { label: 'Open order value', value: fmtMoney(selected.open_revenue) },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Delivery commitments ({selected.orders.length})</h3>
              {selected.orders.length === 0 ? <p className="text-sm text-slate-500">No production orders for this customer.</p> : (
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Order</th><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Committed</th><th className="px-3 py-2">Projected</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selected.orders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-3 py-2"><Link to={`/orders/${o.id}`} className="font-medium text-sky-700 hover:underline">{o.order_number}</Link></td>
                          <td className="px-3 py-2 text-slate-700">{o.product_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(o.quantity)}</td>
                          <td className="px-3 py-2">{fmtDate(o.committed_delivery_date)}</td>
                          <td className={`px-3 py-2 ${o.late_days > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{fmtDate(o.projected_completion_date)}{o.late_days > 0 && <span className="block text-xs">{o.late_days} d late · {fmtMoney(o.sla_penalty)}</span>}</td>
                          <td className="px-3 py-2"><Badge tone={statusTone(o.status)} size="sm">{titleCase(o.status)}</Badge></td>
                          <td className="px-3 py-2"><Badge tone={riskTone(o.risk_level)} size="sm">{titleCase(o.risk_level)}</Badge></td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(o.revenue_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
