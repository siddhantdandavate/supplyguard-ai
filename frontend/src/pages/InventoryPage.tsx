import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Inventory } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, SearchInput, Select } from '../components/ui/Inputs';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { fmtMoney, fmtNumber, titleCase } from '../lib/format';

const statusRank = { critical: 0, low: 1, healthy: 2 };

export const InventoryPage: React.FC = () => {
  const toast = useToast();
  const [params] = useSearchParams();
  const { data, loading, error, reload, setData } = useFetch(() => api.getInventory(), []);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<Inventory | null>(null);
  const [form, setForm] = useState({ current_stock: '', reserved_stock: '', reorder_point: '', location: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = params.get('q');
    if (q) setSearch(q);
  }, [params]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((i) => {
      const matchQ = !q || [i.material?.sku ?? '', i.material?.name ?? '', i.location, i.material?.supplier?.name ?? '', i.material?.category ?? ''].some((v) => v.toLowerCase().includes(q));
      return matchQ && (status === 'all' || i.stock_status === status);
    });
  }, [data, search, status]);

  const counts = useMemo(() => ({
    critical: (data ?? []).filter((i) => i.stock_status === 'critical').length,
    low: (data ?? []).filter((i) => i.stock_status === 'low').length,
    healthy: (data ?? []).filter((i) => i.stock_status === 'healthy').length,
  }), [data]);

  const openEdit = (i: Inventory) => {
    setEditing(i);
    setForm({ current_stock: String(i.current_stock), reserved_stock: String(i.reserved_stock), reorder_point: String(i.reorder_point), location: i.location });
  };

  const formErrors = {
    current_stock: form.current_stock === '' || Number(form.current_stock) < 0 || !Number.isInteger(Number(form.current_stock)) ? 'Enter a whole number ≥ 0.' : null,
    reserved_stock: form.reserved_stock === '' || Number(form.reserved_stock) < 0 || !Number.isInteger(Number(form.reserved_stock)) ? 'Enter a whole number ≥ 0.' : null,
    reorder_point: form.reorder_point === '' || Number(form.reorder_point) < 0 || !Number.isInteger(Number(form.reorder_point)) ? 'Enter a whole number ≥ 0.' : null,
    location: form.location.trim() === '' ? 'Location is required.' : null,
  };
  const invalid = Object.values(formErrors).some(Boolean);

  const save = async () => {
    if (!editing || invalid) return;
    setSaving(true);
    try {
      const updated = await api.updateInventory(editing.id, { current_stock: Number(form.current_stock), reserved_stock: Number(form.reserved_stock), reorder_point: Number(form.reorder_point), location: form.location.trim() });
      setData((data ?? []).map((i) => (i.id === updated.id ? updated : i)));
      toast.success('Inventory updated', `${updated.material?.sku}: ${fmtNumber(updated.available_stock)} available.`);
      setEditing(null);
    } catch (err) {
      toast.error('Could not save inventory', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Inventory>[] = [
    { key: 'sku', header: 'SKU', render: (i) => <span className="font-medium text-slate-900">{i.material?.sku}</span>, sortValue: (i) => i.material?.sku ?? '' },
    { key: 'name', header: 'Material', render: (i) => (<span><span className="block text-slate-900">{i.material?.name}</span><span className="block text-xs text-slate-500">{i.material?.category} · {fmtMoney(i.material?.unit_cost)} / {i.material?.unit_of_measure}</span></span>), sortValue: (i) => i.material?.name ?? '' },
    { key: 'current', header: 'Current', render: (i) => <span className="tabular-nums">{fmtNumber(i.current_stock)}</span>, sortValue: (i) => i.current_stock, align: 'right' },
    { key: 'reserved', header: 'Reserved', render: (i) => <span className="tabular-nums text-amber-700">{fmtNumber(i.reserved_stock)}</span>, sortValue: (i) => i.reserved_stock, align: 'right' },
    { key: 'available', header: 'Available', render: (i) => <span className={`tabular-nums font-semibold ${i.stock_status === 'critical' ? 'text-rose-700' : i.stock_status === 'low' ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtNumber(i.available_stock)}</span>, sortValue: (i) => i.available_stock, align: 'right' },
    { key: 'reorder', header: 'Reorder at', render: (i) => <span className="tabular-nums text-slate-500">{fmtNumber(i.reorder_point)}</span>, sortValue: (i) => i.reorder_point, align: 'right' },
    { key: 'supplier', header: 'Supplier', render: (i) => (<span><span className="block">{i.material?.supplier?.name ?? '—'}</span>{i.material?.alternate_supplier && <span className="block text-xs text-slate-500">Alt: {i.material.alternate_supplier.name}</span>}</span>), sortValue: (i) => i.material?.supplier?.name ?? '' },
    { key: 'location', header: 'Location', render: (i) => i.location, sortValue: (i) => i.location },
    { key: 'status', header: 'Stock status', render: (i) => <Badge tone={statusTone(i.stock_status)}>{i.stock_status === 'critical' ? 'Critical shortage' : i.stock_status === 'low' ? 'Low stock' : 'Healthy'}</Badge>, sortValue: (i) => statusRank[i.stock_status] },
    { key: 'edit', header: '', render: (i) => <Button variant="ghost" size="sm" icon={Pencil} onClick={(e) => { e.stopPropagation(); openEdit(i); }} aria-label={`Adjust ${i.material?.sku}`}>Adjust</Button>, align: 'right' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock on hand, reservations against production orders, free stock and reorder thresholds." />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: 'critical', label: 'Critical shortage', desc: 'No free stock', value: counts.critical, cls: 'text-rose-700' },
          { k: 'low', label: 'Low stock', desc: 'At or below reorder point', value: counts.low, cls: 'text-amber-700' },
          { k: 'healthy', label: 'Healthy', desc: 'Above reorder point', value: counts.healthy, cls: 'text-emerald-700' },
        ].map((c) => (
          <button key={c.k} onClick={() => setStatus((s) => (s === c.k ? 'all' : c.k))} className={`rounded-lg border bg-white p-4 text-left shadow-card transition-colors ${status === c.k ? 'border-sky-600 ring-1 ring-sky-600' : 'border-slate-200 hover:border-slate-300'}`} aria-pressed={status === c.k}>
            <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{c.label}</span><Badge tone={statusTone(c.k)} size="sm">{c.k === 'low' ? 'Low' : titleCase(c.k)}</Badge></div>
            <div className={`mt-1 text-2xl font-semibold ${c.cls}`}>{loading ? '—' : c.value}</div>
            <div className="text-xs text-slate-500">{c.desc}</div>
          </button>
        ))}
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search SKU, material, supplier, location…" className="md:w-80" aria-label="Search inventory" />
          <div className="flex items-center gap-2">
            <label htmlFor="i-status" className="text-xs text-slate-500">Stock status</label>
            <Select id="i-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
              <option value="all">All</option>
              <option value="critical">Critical shortage</option>
              <option value="low">Low stock</option>
              <option value="healthy">Healthy</option>
            </Select>
          </div>
        </div>
        <DataState loading={loading} error={error} onRetry={() => reload()} isEmpty={(data ?? []).length === 0} empty={<EmptyState icon={Boxes} title="No inventory records" />}>
          <Table columns={columns} rows={rows} rowKey={(i) => i.id} initialSort={{ key: 'status', dir: 'asc' }} caption="Inventory" emptyMessage={<EmptyState title="No matches" description="Try a different search or clear the filters." />} />
        </DataState>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Showing {rows.length} of {data?.length ?? 0} · Available = current − reserved</div>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Adjust ${editing.material?.sku}` : 'Adjust inventory'}
        description={editing?.material?.name}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} isLoading={saving} disabled={invalid}>Save changes</Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Current stock" htmlFor="cur" error={formErrors.current_stock}>
            <Input id="cur" type="number" min={0} step={1} value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} invalid={!!formErrors.current_stock} />
          </Field>
          <Field label="Reserved stock" htmlFor="res" error={formErrors.reserved_stock}>
            <Input id="res" type="number" min={0} step={1} value={form.reserved_stock} onChange={(e) => setForm({ ...form, reserved_stock: e.target.value })} invalid={!!formErrors.reserved_stock} />
          </Field>
          <Field label="Reorder point" htmlFor="rop" error={formErrors.reorder_point}>
            <Input id="rop" type="number" min={0} step={1} value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} invalid={!!formErrors.reorder_point} />
          </Field>
          <Field label="Location" htmlFor="loc" error={formErrors.location}>
            <Input id="loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} invalid={!!formErrors.location} />
          </Field>
          <p className="col-span-2 text-xs text-slate-500">
            Available after save: <span className="font-medium text-slate-800">{Math.max(0, Number(form.current_stock || 0) - Number(form.reserved_stock || 0))}</span>. Changing stock changes every shortage and War Room result immediately.
          </p>
        </form>
      </Modal>
    </div>
  );
};
