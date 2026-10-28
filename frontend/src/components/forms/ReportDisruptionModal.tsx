import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { DisruptionSummary, Material, SupplierDetail } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Inputs';
import { Alert } from '../ui/Alert';
import { useToast } from '../../context/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (d: DisruptionSummary) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const ReportDisruptionModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<SupplierDetail[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [form, setForm] = useState({ po_number: '', supplier_id: '', material_id: '', quantity_delayed: '', original_eta: todayIso(), revised_eta: plusDays(7), reason: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingRefs(true);
    Promise.all([api.getSuppliers(), api.getMaterials()])
      .then(([s, m]) => {
        setSuppliers(s);
        setMaterials(m);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load suppliers and materials'))
      .finally(() => setLoadingRefs(false));
  }, [open]);

  // Materials for the chosen supplier first, then the rest.
  const materialOptions = useMemo(() => {
    const sid = Number(form.supplier_id);
    return [...materials].sort((a, b) => Number(b.supplier_id === sid) - Number(a.supplier_id === sid) || a.sku.localeCompare(b.sku));
  }, [materials, form.supplier_id]);

  const errors = {
    po_number: form.po_number.trim().length < 2 ? 'Enter the purchase order reference.' : null,
    supplier_id: form.supplier_id ? null : 'Choose the supplier.',
    material_id: form.material_id ? null : 'Choose the delayed material.',
    quantity_delayed: Number(form.quantity_delayed) > 0 && Number.isInteger(Number(form.quantity_delayed)) ? null : 'Enter a whole quantity greater than 0.',
    original_eta: form.original_eta ? null : 'Required.',
    revised_eta: !form.revised_eta ? 'Required.' : form.revised_eta < form.original_eta ? 'Revised ETA cannot be before the original ETA.' : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);
  const delayDays = form.original_eta && form.revised_eta ? Math.round((new Date(form.revised_eta).getTime() - new Date(form.original_eta).getTime()) / 86400000) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.reportDisruption({
        po_number: form.po_number.trim(),
        supplier_id: Number(form.supplier_id),
        material_id: Number(form.material_id),
        quantity_delayed: Number(form.quantity_delayed),
        original_eta: form.original_eta,
        revised_eta: form.revised_eta,
        reason: form.reason.trim() || undefined,
      });
      toast.success('Disruption reported', `${created.po_number} classified as ${created.impact_severity}: ${created.late_orders_count} order(s) would finish late.`);
      setForm({ po_number: '', supplier_id: '', material_id: '', quantity_delayed: '', original_eta: todayIso(), revised_eta: plusDays(7), reason: '' });
      setTouched(false);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not report the disruption');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a supplier disruption"
      description="Severity, affected orders and the recommended recovery are computed as soon as it is saved."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={loadingRefs}>Save disruption</Button>
        </>
      }
    >
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Purchase order reference" htmlFor="po" error={show('po_number')}>
          <Input id="po" value={form.po_number} onChange={set('po_number')} placeholder="PO-10042" invalid={!!show('po_number')} />
        </Field>
        <Field label="Quantity in shipment" htmlFor="qty" error={show('quantity_delayed')}>
          <Input id="qty" type="number" min={1} step={1} value={form.quantity_delayed} onChange={set('quantity_delayed')} invalid={!!show('quantity_delayed')} />
        </Field>
        <Field label="Supplier" htmlFor="sup" error={show('supplier_id')}>
          <Select id="sup" value={form.supplier_id} onChange={set('supplier_id')} disabled={loadingRefs}>
            <option value="">{loadingRefs ? 'Loading…' : 'Select supplier'}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </Select>
        </Field>
        <Field label="Delayed material" htmlFor="mat" error={show('material_id')}>
          <Select id="mat" value={form.material_id} onChange={set('material_id')} disabled={loadingRefs}>
            <option value="">{loadingRefs ? 'Loading…' : 'Select material'}</option>
            {materialOptions.map((m) => <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>)}
          </Select>
        </Field>
        <Field label="Original ETA" htmlFor="oeta" error={show('original_eta')}>
          <Input id="oeta" type="date" value={form.original_eta} onChange={set('original_eta')} invalid={!!show('original_eta')} />
        </Field>
        <Field label="Revised ETA" htmlFor="reta" error={show('revised_eta')} hint={delayDays > 0 ? `${delayDays} day delay` : undefined}>
          <Input id="reta" type="date" value={form.revised_eta} onChange={set('revised_eta')} invalid={!!show('revised_eta')} />
        </Field>
        <Field label="Reason (optional)" htmlFor="reason" className="sm:col-span-2">
          <Input id="reason" value={form.reason} onChange={set('reason')} placeholder="Customs hold, carrier capacity, quality rejection…" maxLength={255} />
        </Field>
      </form>
    </Modal>
  );
};
