import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  History,
  Layers,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { ShipmentDelay, Supplier, SupplierShipmentUpdatePayload } from '../types/api';
import { Card } from '../components/ui/Card';
import { Badge, Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Alert } from '../components/ui/Alert';
import { DataState, EmptyState } from '../components/ui/States';
import { fmtDate, fmtNumber } from '../lib/format';

const QUICK_REASONS = [
  'Customs inspection hold at export terminal',
  'Carrier blank sailing; rebooked to next vessel',
  'Air freight carrier transit delay',
  'Port terminal congestion and vessel delay',
  'Component allocation shortfall at distributor',
  'Production equipment maintenance pushed finishing run',
];

export const SupplierWorkspacePage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<Supplier | null>(null);
  const [shipments, setShipments] = useState<ShipmentDelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Update modal state
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDelay | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState('active');
  const [newEta, setNewEta] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [newReason, setNewReason] = useState('');
  const [newNote, setNewNote] = useState('');

  // History modal state
  const [historyShipment, setHistoryShipment] = useState<ShipmentDelay | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Confirmation banner state after saving
  const [lastConfirmation, setLastConfirmation] = useState<{
    poNumber: string;
    revisedEta: string;
    quantity: number;
    delayDays: number;
    status: string;
    savedAt: string;
  } | null>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [profData, shipData] = await Promise.all([
        api.getSupplierProfile().catch(() => null),
        api.getSupplierShipments(),
      ]);
      setProfile(profData);
      setShipments(shipData);
      if (isManualRefresh) {
        toast.success('Workspace updated', 'Loaded latest shipment data from the backend.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load supplier data';
      setError(msg);
      toast.error('Data load error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openUpdateModal = (s: ShipmentDelay) => {
    setSelectedShipment(s);
    setNewStatus(s.status);
    setNewEta(s.revised_eta);
    setNewQuantity(s.quantity_delayed);
    setNewReason(s.reason || '');
    setNewNote('');
    setUpdateModalOpen(true);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    if (!newEta) {
      toast.error('Validation error', 'Please select a valid revised ETA.');
      return;
    }

    setSaving(true);
    try {
      const payload: SupplierShipmentUpdatePayload = {
        status: newStatus,
        revised_eta: newEta,
        quantity_delayed: Number(newQuantity),
        reason: newReason.trim() || undefined,
        note: newNote.trim() || undefined,
      };

      const updated = await api.updateSupplierShipment(selectedShipment.id, payload);

      // Update shipment in local state
      setShipments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      // Set confirmation banner
      setLastConfirmation({
        poNumber: updated.po_number,
        revisedEta: updated.revised_eta,
        quantity: updated.quantity_delayed,
        delayDays: updated.delay_days,
        status: updated.status,
        savedAt: new Date().toLocaleTimeString(),
      });

      setUpdateModalOpen(false);
      toast.success(
        'Shipment update saved',
        `${updated.po_number}: Revised ETA set to ${fmtDate(updated.revised_eta)}. Manufacturing planner notified.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update shipment';
      toast.error('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const openHistoryModal = (s: ShipmentDelay) => {
    setHistoryShipment(s);
    setHistoryModalOpen(true);
  };

  // Filtered shipments
  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.po_number.toLowerCase().includes(q) ||
        (s.material?.name ?? '').toLowerCase().includes(q) ||
        (s.material?.sku ?? '').toLowerCase().includes(q) ||
        (s.reason ?? '').toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && (s.status === 'active' || s.status === 'delayed' || s.status === 'customs_hold')) ||
        s.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [shipments, search, statusFilter]);

  const statusTone = (status: string): Tone => {
    switch (status) {
      case 'resolved':
      case 'delivered':
        return 'success';
      case 'mitigated':
        return 'info';
      case 'customs_hold':
      case 'delayed':
      case 'active':
        return 'critical';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Supplier Workspace Top Banner */}
      <div className="overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-indigo-600/80 p-3 ring-1 ring-white/20">
              <Truck className="h-7 w-7 text-white" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {profile?.name ?? 'Supplier Shipment Workspace'}
                </h1>
                <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-200 ring-1 ring-indigo-400/30">
                  {profile?.code ?? 'Restricted Portal'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Logistics & Carrier Updates for Manufacturing Purchase Orders
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
                  {profile?.contact_name ?? user?.full_name} ({user?.email})
                </span>
                {profile?.location && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {profile.location}
                  </span>
                )}
                {profile?.lead_time_days != null && (
                  <span>Standard Lead Time: {profile.lead_time_days} days</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              isLoading={refreshing}
              onClick={() => loadData(true)}
              className="border-indigo-700 bg-indigo-900/60 text-indigo-100 hover:bg-indigo-800"
            >
              Sync Shipments
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Banner */}
      {lastConfirmation && (
        <Alert
          kind="success"
          title={`Update confirmed for ${lastConfirmation.poNumber}`}
          className="border-emerald-200 bg-emerald-50 text-emerald-900"
        >
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>
              Revised ETA saved as <strong>{fmtDate(lastConfirmation.revisedEta)}</strong> (+{lastConfirmation.delayDays} days).
              Status: <span className="capitalize">{lastConfirmation.status.replace('_', ' ')}</span>.
              Affected quantity: <strong>{fmtNumber(lastConfirmation.quantity)} units</strong>.
            </span>
            <span className="text-slate-500">Saved at {lastConfirmation.savedAt} · Planner notified</span>
          </div>
        </Alert>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Package className="h-4 w-4 text-slate-400" /> Total Assigned POs
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {shipments.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Managed in your supplier queue</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <AlertTriangle className="h-4 w-4 text-rose-500" /> Active Delay / Hold
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-rose-700">
            {shipments.filter((s) => s.status === 'active' || s.status === 'delayed' || s.status === 'customs_hold').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Requiring planner coordination</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Mitigated / On Track
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
            {shipments.filter((s) => s.status === 'mitigated' || s.status === 'resolved' || s.status === 'delivered').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Recovery plan agreed or delivered</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Layers className="h-4 w-4 text-indigo-500" /> Total Affected Units
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-indigo-700">
            {fmtNumber(shipments.reduce((sum, s) => sum + s.quantity_delayed, 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Component parts in transit</div>
        </div>
      </div>

      {/* Main Shipment List Section */}
      <Card
        title="Assigned Purchase Orders"
        subtitle="Only shipments assigned to your company are visible in this restricted workspace."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO or part…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 py-1.5 px-2.5 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Exceptions</option>
              <option value="customs_hold">Customs Hold</option>
              <option value="mitigated">Mitigated</option>
              <option value="resolved">Resolved</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        }
        bodyClassName="p-0"
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={() => loadData()}
          isEmpty={filtered.length === 0}
          empty={
            <EmptyState
              icon={Package}
              title="No shipments found"
              description="No assigned purchase orders match your filter criteria."
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-5 py-3">PO Number</th>
                  <th scope="col" className="px-4 py-3">Material & SKU</th>
                  <th scope="col" className="px-4 py-3 text-right">Quantity</th>
                  <th scope="col" className="px-4 py-3">Shipment Status</th>
                  <th scope="col" className="px-4 py-3">Original ETA</th>
                  <th scope="col" className="px-4 py-3">Revised ETA</th>
                  <th scope="col" className="px-4 py-3">Delay Reason</th>
                  <th scope="col" className="px-4 py-3">Last Update</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const hasHistory = s.update_history && s.update_history.length > 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                        {s.po_number}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {s.material?.name ?? 'Component'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {s.material?.sku}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums font-semibold text-slate-900">
                        {fmtNumber(s.quantity_delayed)} {s.material?.unit_of_measure ?? 'PCS'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <Badge tone={statusTone(s.status)}>
                          {s.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                        {fmtDate(s.original_eta)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="text-xs font-semibold text-slate-900">
                          {fmtDate(s.revised_eta)}
                        </div>
                        <div className={`text-[11px] font-medium tabular-nums ${s.delay_days > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {s.delay_days > 0 ? `+${s.delay_days} days slip` : 'On schedule'}
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-4 text-xs text-slate-600" title={s.reason ?? ''}>
                        {s.reason || <span className="text-slate-400 italic">No reason recorded</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                        {s.updated_at ? (
                          <>
                            <div>{fmtDate(s.updated_at)}</div>
                            <div className="text-[10px] text-slate-400 capitalize">
                              by {s.last_updated_by_role ?? 'system'}
                            </div>
                          </>
                        ) : (
                          fmtDate(s.reported_at)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={() => openHistoryModal(s)}
                              className="rounded border border-slate-200 p-1.5 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                              title="View update history"
                              aria-label={`View history for ${s.po_number}`}
                            >
                              <History className="h-4 w-4" />
                            </button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => openUpdateModal(s)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                          >
                            Update
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      {/* Update Shipment Modal */}
      <Modal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title={`Update Shipment ${selectedShipment?.po_number ?? ''}`}
        description={`${selectedShipment?.material?.name ?? ''} (${selectedShipment?.material?.sku ?? ''})`}
        size="md"
      >
        {selectedShipment && (
          <form onSubmit={handleSaveUpdate} className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Original ETA:</span>{' '}
                  <span className="font-semibold text-slate-800">{fmtDate(selectedShipment.original_eta)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Current Status:</span>{' '}
                  <span className="font-semibold text-slate-800 uppercase">{selectedShipment.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="shipment-status" className="mb-1 block text-xs font-semibold text-slate-700">
                  Shipment Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="shipment-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="active">Active / Delayed</option>
                  <option value="in_transit">In Transit (Normal)</option>
                  <option value="customs_hold">Customs Hold</option>
                  <option value="mitigated">Mitigated / Recovered</option>
                  <option value="delivered">Delivered to Dock</option>
                </select>
              </div>

              <div>
                <label htmlFor="revised-eta" className="mb-1 block text-xs font-semibold text-slate-700">
                  Revised ETA <span className="text-rose-500">*</span>
                </label>
                <input
                  id="revised-eta"
                  type="date"
                  value={newEta}
                  onChange={(e) => setNewEta(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="affected-qty" className="mb-1 block text-xs font-semibold text-slate-700">
                Affected Quantity ({selectedShipment.material?.unit_of_measure ?? 'PCS'}) <span className="text-rose-500">*</span>
              </label>
              <input
                id="affected-qty"
                type="number"
                min={0}
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                required
              />
            </div>

            <div>
              <label htmlFor="delay-reason" className="mb-1 block text-xs font-semibold text-slate-700">
                Delay Reason
              </label>
              <input
                id="delay-reason"
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Export customs inspection hold at Frankfurt terminal"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500">Common reasons:</span>
                {QUICK_REASONS.map((qr) => (
                  <button
                    key={qr}
                    type="button"
                    onClick={() => setNewReason(qr)}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="update-note" className="mb-1 block text-xs font-semibold text-slate-700">
                Carrier / Logistics Note (optional)
              </label>
              <textarea
                id="update-note"
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Broker tracking number, next vessel booking, or carrier notes for planner…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setUpdateModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save & Notify Planner
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Update History Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Update History for ${historyShipment?.po_number ?? ''}`}
        description={`${historyShipment?.material?.name ?? ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {(!historyShipment?.update_history || historyShipment.update_history.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No prior updates logged for this shipment.
            </div>
          ) : (
            <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {historyShipment.update_history.map((h, idx) => (
                <div key={h.id || idx} className="relative mb-6 last:mb-0">
                  <span className="absolute -left-6 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-600 ring-2 ring-indigo-100" />
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {fmtDate(h.updated_at)}
                      </span>
                      <span className="text-slate-500">
                        Logged by {h.updated_by_name ?? 'Supplier'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-slate-500 block">Status:</span>
                        <span className="font-semibold uppercase text-slate-800">
                          {h.previous_status ? `${h.previous_status} → ` : ''}
                          {h.new_status}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Revised ETA:</span>
                        <span className="font-semibold text-slate-800">
                          {h.previous_revised_eta ? `${fmtDate(h.previous_revised_eta)} → ` : ''}
                          {fmtDate(h.new_revised_eta)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Quantity:</span>
                        <span className="font-semibold text-slate-800">
                          {fmtNumber(h.new_quantity_delayed)} units
                        </span>
                      </div>
                    </div>
                    {h.delay_reason && (
                      <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-700">
                        <span className="font-semibold text-slate-900">Reason:</span> {h.delay_reason}
                      </div>
                    )}
                    {h.note && (
                      <div className="mt-2 text-xs text-slate-600 italic">
                        Note: &ldquo;{h.note}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
