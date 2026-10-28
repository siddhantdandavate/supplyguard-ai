import React, { useState } from 'react';
import { api } from '../../services/api';
import { Customer, Supplier } from '../../types/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Inputs';
import { Alert } from '../ui/Alert';
import { useToast } from '../../context/ToastContext';

const emailOk = (v: string) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

interface SupplierProps {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Supplier) => void;
}

export const SupplierFormModal: React.FC<SupplierProps> = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', code: '', contact_name: '', email: '', phone: '', location: '', lead_time_days: '14', on_time_delivery_rate: '92', reliability_score: '8.5' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const errors = {
    name: form.name.trim().length < 2 ? 'Enter the supplier name.' : null,
    code: form.code.trim().length < 2 ? 'Enter a short unique code.' : null,
    email: emailOk(form.email.trim()) ? null : 'Enter a valid email or leave blank.',
    lead_time_days: Number.isInteger(Number(form.lead_time_days)) && Number(form.lead_time_days) >= 0 ? null : 'Whole days, 0 or more.',
    on_time_delivery_rate: Number(form.on_time_delivery_rate) >= 0 && Number(form.on_time_delivery_rate) <= 100 ? null : '0 to 100.',
    reliability_score: Number(form.reliability_score) >= 0 && Number(form.reliability_score) <= 10 ? null : '0 to 10.',
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createSupplier({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        location: form.location.trim() || undefined,
        lead_time_days: Number(form.lead_time_days),
        on_time_delivery_rate: Number(form.on_time_delivery_rate) / 100,
        reliability_score: Number(form.reliability_score),
      });
      toast.success('Supplier added', `${created.name} (${created.code}) is now available as a source.`);
      setForm({ name: '', code: '', contact_name: '', email: '', phone: '', location: '', lead_time_days: '14', on_time_delivery_rate: '92', reliability_score: '8.5' });
      setTouched(false);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add supplier" size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} isLoading={saving}>Add supplier</Button></>}>
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="s-name" error={show('name')}><Input id="s-name" value={form.name} onChange={set('name')} invalid={!!show('name')} /></Field>
        <Field label="Code" htmlFor="s-code" error={show('code')} hint="e.g. SUP-ACM-07"><Input id="s-code" value={form.code} onChange={set('code')} invalid={!!show('code')} /></Field>
        <Field label="Contact name" htmlFor="s-contact"><Input id="s-contact" value={form.contact_name} onChange={set('contact_name')} /></Field>
        <Field label="Email" htmlFor="s-email" error={show('email')}><Input id="s-email" type="email" value={form.email} onChange={set('email')} invalid={!!show('email')} /></Field>
        <Field label="Phone" htmlFor="s-phone"><Input id="s-phone" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Location" htmlFor="s-loc"><Input id="s-loc" value={form.location} onChange={set('location')} placeholder="City, Country" /></Field>
        <Field label="Standard lead time (days)" htmlFor="s-lead" error={show('lead_time_days')}><Input id="s-lead" type="number" min={0} step={1} value={form.lead_time_days} onChange={set('lead_time_days')} invalid={!!show('lead_time_days')} /></Field>
        <Field label="On-time delivery rate (%)" htmlFor="s-otd" error={show('on_time_delivery_rate')}><Input id="s-otd" type="number" min={0} max={100} step={1} value={form.on_time_delivery_rate} onChange={set('on_time_delivery_rate')} invalid={!!show('on_time_delivery_rate')} /></Field>
        <Field label="Reliability score (0-10)" htmlFor="s-rel" error={show('reliability_score')}><Input id="s-rel" type="number" min={0} max={10} step={0.1} value={form.reliability_score} onChange={set('reliability_score')} invalid={!!show('reliability_score')} /></Field>
      </form>
    </Modal>
  );
};

interface CustomerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerProps> = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', code: '', tier: 'Tier 2 - Preferred', contact_name: '', email: '', phone: '', sla_penalty_per_day: '500', priority_score: '60' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const errors = {
    name: form.name.trim().length < 2 ? 'Enter the customer name.' : null,
    code: form.code.trim().length < 2 ? 'Enter a short unique code.' : null,
    email: emailOk(form.email.trim()) ? null : 'Enter a valid email or leave blank.',
    sla_penalty_per_day: Number(form.sla_penalty_per_day) >= 0 ? null : 'Must be 0 or more.',
    priority_score: Number.isInteger(Number(form.priority_score)) && Number(form.priority_score) >= 1 && Number(form.priority_score) <= 100 ? null : 'Whole number 1 to 100.',
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCustomer({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        tier: form.tier,
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        sla_penalty_per_day: Number(form.sla_penalty_per_day),
        priority_score: Number(form.priority_score),
      });
      toast.success('Customer added', `${created.name} (${created.code}) created.`);
      setForm({ name: '', code: '', tier: 'Tier 2 - Preferred', contact_name: '', email: '', phone: '', sla_penalty_per_day: '500', priority_score: '60' });
      setTouched(false);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add customer" size="lg" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={submit} isLoading={saving}>Add customer</Button></>}>
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c-name" error={show('name')}><Input id="c-name" value={form.name} onChange={set('name')} invalid={!!show('name')} /></Field>
        <Field label="Code" htmlFor="c-code" error={show('code')} hint="e.g. CUST-ACM-05"><Input id="c-code" value={form.code} onChange={set('code')} invalid={!!show('code')} /></Field>
        <Field label="Tier" htmlFor="c-tier">
          <Select id="c-tier" value={form.tier} onChange={set('tier')}>
            <option>Tier 1 - Strategic</option>
            <option>Tier 2 - Preferred</option>
            <option>Tier 3 - Standard</option>
          </Select>
        </Field>
        <Field label="Priority score (1-100)" htmlFor="c-prio" error={show('priority_score')} hint="Higher priority gets scarce material first"><Input id="c-prio" type="number" min={1} max={100} step={1} value={form.priority_score} onChange={set('priority_score')} invalid={!!show('priority_score')} /></Field>
        <Field label="SLA penalty per late day ($)" htmlFor="c-sla" error={show('sla_penalty_per_day')}><Input id="c-sla" type="number" min={0} step={50} value={form.sla_penalty_per_day} onChange={set('sla_penalty_per_day')} invalid={!!show('sla_penalty_per_day')} /></Field>
        <Field label="Contact name" htmlFor="c-contact"><Input id="c-contact" value={form.contact_name} onChange={set('contact_name')} /></Field>
        <Field label="Email" htmlFor="c-email" error={show('email')}><Input id="c-email" type="email" value={form.email} onChange={set('email')} invalid={!!show('email')} /></Field>
        <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" value={form.phone} onChange={set('phone')} /></Field>
      </form>
    </Modal>
  );
};
