import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, Plus, SlidersHorizontal } from 'lucide-react';
import { ReportDisruptionModal } from '../components/forms/ReportDisruptionModal';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { DisruptionSummary } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, riskTone, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput, Select } from '../components/ui/Inputs';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { fmtDate, fmtMoney, fmtNumber, titleCase } from '../lib/format';

export const DisruptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(() => api.getDisruptions(), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [reportOpen, setReportOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      const matchQ = !q || [d.po_number, d.supplier_name, d.material_name, d.material_sku, d.reason ?? ''].some((v) => v.toLowerCase().includes(q));
      return matchQ && (status === 'all' || d.status === status) && (severity === 'all' || d.impact_severity === severity);
    });
  }, [data, search, status, severity]);

  const counts = useMemo(() => {
    const all = data ?? [];
    return { active: all.filter((d) => d.status === 'active').length, critical: all.filter((d) => d.status === 'active' && d.impact_severity === 'critical').length, exposure: all.filter((d) => d.status === 'active').reduce((s, d) => s + d.sla_penalty_exposure, 0) };
  }, [data]);

  const columns: Column<DisruptionSummary>[] = [
    { key: 'po', header: 'Shipment ref', render: (d) => <span className="font-medium text-slate-900">{d.po_number}</span>, sortValue: (d) => d.po_number },
    { key: 'supplier', header: 'Supplier', render: (d) => d.supplier_name, sortValue: (d) => d.supplier_name },
    { key: 'material', header: 'Material', render: (d) => (<span><span className="block text-slate-900">{d.material_name}</span><span className="block text-xs text-slate-500">{d.material_sku} · {fmtNumber(d.quantity_delayed)} units</span></span>), sortValue: (d) => d.material_name },
    { key: 'orig', header: 'Original ETA', render: (d) => fmtDate(d.original_eta), sortValue: (d) => d.original_eta },
    { key: 'rev', header: 'Revised ETA', render: (d) => (
      <div>
        <span className="text-rose-700 font-medium">{fmtDate(d.revised_eta)}</span>
        {d.last_updated_by_role === 'supplier' && (
          <span className="block text-[10px] font-semibold text-indigo-700">Supplier updated</span>
        )}
      </div>
    ), sortValue: (d) => d.revised_eta },
    { key: 'delay', header: 'Delay', render: (d) => <span className="font-medium">+{d.delay_days} d</span>, sortValue: (d) => d.delay_days, align: 'right' },
    { key: 'affected', header: 'Affected orders', render: (d) => (<span>{d.affected_orders_count}{d.late_orders_count > 0 && <span className="block text-xs text-rose-600">{d.late_orders_count} late</span>}</span>), sortValue: (d) => d.affected_orders_count, align: 'right' },
    { key: 'exposure', header: 'Penalty exposure', render: (d) => <span className={d.sla_penalty_exposure > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}>{fmtMoney(d.sla_penalty_exposure)}</span>, sortValue: (d) => d.sla_penalty_exposure, align: 'right' },
    { key: 'severity', header: 'Risk', render: (d) => <Badge tone={riskTone(d.impact_severity)}>{titleCase(d.impact_severity)}</Badge>, sortValue: (d) => ({ critical: 0, high: 1, medium: 2 })[d.impact_severity] },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={statusTone(d.status)}>{titleCase(d.status)}</Badge>, sortValue: (d) => d.status },
    { key: 'plan', header: 'Adopted plan', render: (d) => d.adopted_strategy ? <span className="text-emerald-700">{d.adopted_strategy}</span> : <span className="text-slate-400">—</span>, sortValue: (d) => d.adopted_strategy ?? '' },
    { key: 'go', header: '', render: () => (<span className="inline-flex items-center gap-1 text-sky-700">Details <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>), align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disruptions"
        description="Supplier shipment delays with their computed material shortages, affected orders and SLA exposure."
        actions={
          <>
            <Button variant="secondary" icon={Plus} onClick={() => setReportOpen(true)}>
              Report disruption
            </Button>
            <Button icon={SlidersHorizontal} onClick={() => navigate('/war-room')}>
              Open War Room
            </Button>
          </>
        }
      />

      <ReportDisruptionModal open={reportOpen} onClose={() => setReportOpen(false)} onCreated={(d) => { setReportOpen(false); reload(true); navigate(`/disruptions/${d.id}`); }} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"><div className="text-xs text-slate-500">Active disruptions</div><div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '—' : counts.active}</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"><div className="text-xs text-slate-500">Critical</div><div className={`mt-1 text-2xl font-semibold ${counts.critical > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{loading ? '—' : counts.critical}</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card"><div className="text-xs text-slate-500">Total penalty exposure (active)</div><div className={`mt-1 text-2xl font-semibold ${counts.exposure > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{loading ? '—' : fmtMoney(counts.exposure)}</div></div>
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search PO, supplier, material, reason…" className="md:w-80" aria-label="Search disruptions" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500" htmlFor="status">Status</label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="mitigated">Mitigated</option>
              <option value="resolved">Resolved</option>
            </Select>
            <label className="text-xs text-slate-500" htmlFor="severity">Risk</label>
            <Select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36">
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </Select>
          </div>
        </div>
        <DataState loading={loading} error={error} onRetry={() => reload()} isEmpty={(data ?? []).length === 0} empty={<EmptyState icon={AlertOctagon} title="No disruptions recorded" description="Supplier delays will appear here once reported." />}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/disruptions/${d.id}`)}
            initialSort={{ key: 'exposure', dir: 'desc' }}
            caption="Supplier shipment disruptions"
            emptyMessage={<EmptyState title="No matches" description="Try a different search term or clear the filters." />}
          />
        </DataState>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          Showing {rows.length} of {data?.length ?? 0}
        </div>
      </Card>
    </div>
  );
};
