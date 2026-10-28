import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, MapPin, Phone, Plus, Truck } from 'lucide-react';
import { SupplierFormModal } from '../components/forms/PartnerFormModals';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { SupplierDetail } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, riskTone, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/Inputs';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { KeyValueList } from '../components/ui/KeyValue';
import { fmtDate, fmtMoney, fmtNumber, fmtPct, titleCase } from '../lib/format';

const reliabilityTone = (score: number) => (score >= 9 ? 'success' : score >= 8 ? 'info' : 'high');

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => api.getSuppliers(), []);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((s) => !q || [s.name, s.code, s.location ?? '', s.contact_name ?? ''].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  const selected = id ? (data ?? []).find((s) => s.id === Number(id)) : undefined;

  const columns: Column<SupplierDetail>[] = [
    { key: 'code', header: 'Code', render: (s) => <span className="font-medium text-slate-900">{s.code}</span>, sortValue: (s) => s.code },
    { key: 'name', header: 'Supplier', render: (s) => (<span><span className="block text-slate-900">{s.name}</span><span className="block text-xs text-slate-500">{s.contact_name ?? 'No contact on file'}</span></span>), sortValue: (s) => s.name },
    { key: 'location', header: 'Location', render: (s) => s.location ?? '—', sortValue: (s) => s.location ?? '' },
    { key: 'lead', header: 'Lead time', render: (s) => <span className="tabular-nums">{s.lead_time_days} days</span>, sortValue: (s) => s.lead_time_days, align: 'right' },
    { key: 'otd', header: 'On-time rate', render: (s) => <span className="tabular-nums">{fmtPct(s.on_time_delivery_rate)}</span>, sortValue: (s) => s.on_time_delivery_rate, align: 'right' },
    { key: 'rel', header: 'Reliability', render: (s) => <Badge tone={reliabilityTone(s.reliability_score)}>{s.reliability_score.toFixed(1)} / 10</Badge>, sortValue: (s) => s.reliability_score },
    { key: 'mat', header: 'Materials', render: (s) => <span className="tabular-nums">{s.materials_supplied}</span>, sortValue: (s) => s.materials_supplied, align: 'right' },
    { key: 'ship', header: 'Active delays', render: (s) => <span className={`tabular-nums font-medium ${s.active_shipment_count > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{s.active_shipment_count}</span>, sortValue: (s) => s.active_shipment_count, align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Lead times, reliability and shipment history for every source of supply." actions={<Button icon={Plus} onClick={() => setAddOpen(true)}>Add supplier</Button>} />
      <SupplierFormModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { setAddOpen(false); reload(true); }} />
      <Card bodyClassName="p-0">
        <div className="border-b border-slate-200 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, code, location, contact…" className="md:w-80" aria-label="Search suppliers" />
        </div>
        <DataState loading={loading} error={error} onRetry={() => reload()} isEmpty={(data ?? []).length === 0} empty={<EmptyState icon={Truck} title="No suppliers" />}>
          <Table columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/suppliers/${s.id}`)} initialSort={{ key: 'ship', dir: 'desc' }} caption="Suppliers" emptyMessage={<EmptyState title="No matches" />} />
        </DataState>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Showing {rows.length} of {data?.length ?? 0}</div>
      </Card>

      <Modal open={!!id} onClose={() => navigate('/suppliers')} title={selected?.name ?? 'Supplier'} description={selected?.code} size="xl" footer={<Button variant="secondary" onClick={() => navigate('/suppliers')}>Close</Button>}>
        {!selected && !loading && <EmptyState title="Supplier not found" />}
        {selected && (
          <div className="space-y-5">
            <KeyValueList
              columns={4}
              items={[
                { label: 'Contact', value: selected.contact_name ?? '—' },
                { label: 'Email', value: selected.email ? <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 text-sky-700 hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden />{selected.email}</a> : '—' },
                { label: 'Phone', value: selected.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />{selected.phone}</span> : '—' },
                { label: 'Location', value: selected.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden />{selected.location}</span> : '—' },
                { label: 'Standard lead time', value: `${selected.lead_time_days} days` },
                { label: 'On-time delivery', value: fmtPct(selected.on_time_delivery_rate) },
                { label: 'Reliability score', value: <Badge tone={reliabilityTone(selected.reliability_score)}>{selected.reliability_score.toFixed(1)} / 10</Badge> },
                { label: 'Active shipment delays', value: `${selected.active_shipment_count} of ${selected.total_shipment_count} recorded`, tone: selected.active_shipment_count > 0 ? 'critical' : 'success' },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Materials supplied ({selected.materials.length})</h3>
              {selected.materials.length === 0 ? <p className="text-sm text-slate-500">This supplier is not the primary source for any material.</p> : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selected.materials.map((m) => (
                    <li key={m.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
                      <div className="font-medium text-slate-900">{m.sku}</div>
                      <div className="text-slate-700">{m.name}</div>
                      <div className="text-xs text-slate-500">{fmtMoney(m.unit_cost)} / {m.unit_of_measure} · lead time {m.standard_lead_time_days} d</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Shipment history ({selected.shipments.length})</h3>
              {selected.shipments.length === 0 ? <p className="text-sm text-slate-500">No delayed shipments recorded for this supplier.</p> : (
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">PO</th><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Original ETA</th><th className="px-3 py-2">Revised ETA</th><th className="px-3 py-2 text-right">Delay</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selected.shipments.map((sh) => (
                        <tr key={sh.id}>
                          <td className="px-3 py-2"><Link to={`/disruptions/${sh.id}`} className="font-medium text-sky-700 hover:underline">{sh.po_number}</Link></td>
                          <td className="px-3 py-2 text-slate-700">{sh.material?.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(sh.quantity_delayed)}</td>
                          <td className="px-3 py-2">{fmtDate(sh.original_eta)}</td>
                          <td className="px-3 py-2">{fmtDate(sh.revised_eta)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">+{sh.delay_days} d</td>
                          <td className="px-3 py-2"><Badge tone={riskTone(sh.impact_severity)} size="sm">{titleCase(sh.impact_severity)}</Badge></td>
                          <td className="px-3 py-2"><Badge tone={statusTone(sh.status)} size="sm">{titleCase(sh.status)}</Badge></td>
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
