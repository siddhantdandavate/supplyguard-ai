import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertOctagon, ChevronDown, ChevronUp, Download, History, Loader2, Play, SlidersHorizontal, Star } from 'lucide-react';
import { DecisionLog } from '../components/warroom/DecisionLog';
import { downloadText, scenarioToCsv } from '../lib/csv';
import { RecoveryDecision } from '../types/api';
import { Modal } from '../components/ui/Modal';
import { api, isDemoMode } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { ScenarioAssumptionOverrides, ScenarioResponse, StrategyKey, StrategyOutcome } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge, riskTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Inputs';
import { DataState, EmptyState, ErrorState } from '../components/ui/States';
import { Alert } from '../components/ui/Alert';
import { ExposureChart, DeliveryChart } from '../components/warroom/ComparisonCharts';
import { AssumptionsPanel } from '../components/warroom/AssumptionsPanel';
import { DecisionSummary } from '../components/warroom/DecisionSummary';
import { GuidedDecisionSummary } from '../components/warroom/GuidedDecisionSummary';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtMoney, fmtNumber, titleCase } from '../lib/format';

const STRATEGY_ORDER: StrategyKey[] = ['baseline', 'expedite', 'alternate', 'reallocation', 'combined'];

export const WarRoomPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const delayId = id ? Number(id) : null;

  const disruptions = useFetch(() => api.getDisruptions(), []);
  const candidates = useMemo(() => (disruptions.data ?? []).filter((d) => d.status !== 'resolved').sort((a, b) => b.sla_penalty_exposure - a.sla_penalty_exposure), [disruptions.data]);
  const selected = candidates.find((d) => d.id === delayId) ?? (disruptions.data ?? []).find((d) => d.id === delayId);

  // Scenario state
  const [delayDays, setDelayDays] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<ScenarioAssumptionOverrides>({});
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<StrategyKey | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [confirmAdopt, setConfirmAdopt] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [note, setNote] = useState('');
  const [decisions, setDecisions] = useState<RecoveryDecision[]>([]);
  const reqId = useRef(0);

  // Reset when the disruption changes
  useEffect(() => {
    setDelayDays(null);
    setOverrides({});
    setResult(null);
    setSelectedKey(null);
    setRunError(null);
    setNote('');
    setDecisions([]);
    if (delayId) api.getDisruptionDecisions(delayId).then(setDecisions).catch(() => setDecisions([]));
  }, [delayId]);

  // Auto-run (debounced) whenever inputs change
  useEffect(() => {
    if (!delayId) return;
    const myId = ++reqId.current;
    setRunning(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await api.simulate(delayId, delayDays, overrides);
        if (myId !== reqId.current) return;
        setResult(res);
        setRunError(null);
        setSelectedKey((k) => k ?? res.recommended_key);
        if (delayDays === null) setDelayDays(res.simulated_delay_days);
      } catch (err) {
        if (myId === reqId.current) setRunError(err instanceof Error ? err.message : 'Simulation failed');
      } finally {
        if (myId === reqId.current) setRunning(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [delayId, delayDays, overrides]);

  const strategies = useMemo(() => (result ? STRATEGY_ORDER.map((k) => result.strategies.find((s) => s.key === k)).filter((s): s is StrategyOutcome => !!s) : []), [result]);
  const baseline = strategies.find((s) => s.key === 'baseline');
  const current = strategies.find((s) => s.key === (selectedKey ?? result?.recommended_key));
  const recommended = strategies.find((s) => s.recommended);
  const sliderMax = Math.max(28, (result?.reported_delay_days ?? 14) * 2);

  const isDemo = isDemoMode();

  const adopt = async () => {
    if (!delayId || !current) return;
    setAdopting(true);
    try {
      const decision = await api.adoptDecision(delayId, { strategy_key: current.key, delay_days: delayDays, assumptions: overrides, note: note.trim() || undefined });
      setDecisions((d) => [decision, ...d.map((x) => ({ ...x, status: 'superseded' as const }))]);
      toast.success(
        isDemo ? 'Recovery plan adopted (Demo Mode)' : 'Recovery plan adopted',
        current.key === 'baseline'
          ? `${result?.po_number}: accepting the delay was recorded ${isDemo ? 'in demo session state.' : ''}`
          : `${result?.po_number} marked as mitigated with "${current.name}" ${isDemo ? '(demo session state updated).' : ''}`
      );
      setConfirmAdopt(false);
      setNote('');
      disruptions.reload(true);
    } catch (err) {
      toast.error('Could not adopt plan', err instanceof Error ? err.message : undefined);
    } finally {
      setAdopting(false);
    }
  };

  // ---------- no disruption selected: picker ----------
  if (!delayId) {
    return (
      <div className="space-y-6">
        <PageHeader title="What-If War Room" description="Pick a supplier disruption, adjust the delay and recovery assumptions, and compare strategies on cost versus delivery." />
        <Card title="Choose a disruption to plan for" bodyClassName="p-0">
          <DataState loading={disruptions.loading} error={disruptions.error} onRetry={() => disruptions.reload()} isEmpty={candidates.length === 0} empty={<EmptyState icon={AlertOctagon} title="No open disruptions" description="There is nothing to simulate right now. Resolved disruptions are hidden." />}>
            <ul className="divide-y divide-slate-100">
              {candidates.map((d) => (
                <li key={d.id}>
                  <button onClick={() => navigate(`/war-room/${d.id}`)} className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{d.po_number}</span>
                        <Badge tone={riskTone(d.impact_severity)}>{titleCase(d.impact_severity)}</Badge>
                        <Badge tone="neutral" icon={false}>{titleCase(d.status)}</Badge>
                      </span>
                      <span className="mt-0.5 block text-sm text-slate-600">{d.material_name} from {d.supplier_name} · +{d.delay_days} days</span>
                    </span>
                    <span className="flex items-center gap-6 text-sm">
                      <span><span className="block text-xs text-slate-500">Late orders</span><span className="font-medium text-slate-900">{d.late_orders_count} of {d.affected_orders_count}</span></span>
                      <span><span className="block text-xs text-slate-500">Penalty exposure</span><span className={`font-medium ${d.sla_penalty_exposure > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{fmtMoney(d.sla_penalty_exposure)}</span></span>
                      <SlidersHorizontal className="h-4 w-4 text-sky-700" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: 'What-If War Room', to: '/war-room' }, { label: result?.po_number ?? `Disruption ${delayId}` }]}
        title="What-If War Room"
        badge={selected && <Badge tone={riskTone(selected.impact_severity)}>{titleCase(selected.impact_severity)}</Badge>}
        description={result ? `${result.po_number}: ${fmtNumber(result.total_unfilled_demand)} units of ${result.material_name} short after ${fmtNumber(result.free_stock)} free units. Supplier ${result.supplier_name}, original ETA ${fmtDate(result.original_eta)}.` : 'Loading disruption…'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={Download} onClick={() => result && downloadText(`supplyguard-${result.po_number}-scenario.csv`, scenarioToCsv(result))} disabled={!result}>
              Export CSV
            </Button>
            <label htmlFor="pick" className="text-xs text-slate-500">Disruption</label>
            <Select id="pick" value={delayId} onChange={(e) => navigate(`/war-room/${e.target.value}`)} className="w-64">
              {(disruptions.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.po_number} · {d.material_name} ({d.status})
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => navigate(`/disruptions/${delayId}`)}>
              Disruption details
            </Button>
          </div>
        }
      />

      {disruptions.error && <Alert kind="warning">Could not load the disruption list: {disruptions.error}</Alert>}

      {/* Controls */}
      <Card title="Scenario inputs" subtitle="Results update automatically as you change inputs" action={<span className="flex items-center gap-2 text-xs text-slate-500">{running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Recalculating…</> : result ? 'Up to date' : ''}</span>}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="delay" className="text-sm font-medium text-slate-800">Simulated shipment delay</label>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-slate-900">{delayDays ?? result?.simulated_delay_days ?? '—'} days</span>
            </div>
            <input id="delay" type="range" min={0} max={sliderMax} step={1} value={delayDays ?? result?.simulated_delay_days ?? 0} onChange={(e) => setDelayDays(Number(e.target.value))} className="mt-3 w-full" aria-valuetext={`${delayDays ?? 0} days`} />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>0 days</span>
              <span>Reported: {result?.reported_delay_days ?? '…'} days</span>
              <span>{sliderMax} days</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Quick set:</span>
              {[result?.reported_delay_days ?? 14, 7, 21, 28].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                <button key={v} onClick={() => setDelayDays(v)} className={`rounded-md border px-2 py-0.5 text-xs ${delayDays === v ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {v === result?.reported_delay_days ? `Reported (${v} d)` : `${v} d`}
                </button>
              ))}
              {result && <span className="ml-auto text-xs text-slate-500">Revised ETA at this delay: <span className="font-medium text-slate-800">{fmtDate(result.revised_eta)}</span></span>}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div>
              <div className="text-xs font-semibold text-slate-700">Strategy assumptions</div>
              <p className="mt-0.5 text-xs text-slate-500">{Object.keys(overrides).length === 0 ? 'Using data-derived defaults.' : `${Object.keys(overrides).length} custom value${Object.keys(overrides).length === 1 ? '' : 's'}.`}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={showAssumptions ? ChevronUp : ChevronDown} onClick={() => setShowAssumptions((s) => !s)} aria-expanded={showAssumptions}>
                {showAssumptions ? 'Hide' : 'Adjust'} assumptions
              </Button>
              <Button size="sm" icon={Play} onClick={() => setOverrides((o) => ({ ...o }))} isLoading={running}>
                Run scenario
              </Button>
            </div>
          </div>
        </div>
        {showAssumptions && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <AssumptionsPanel resolved={result?.assumptions ?? null} overrides={overrides} onChange={setOverrides} disabled={running} />
          </div>
        )}
      </Card>

      {runError && !result && <ErrorState message={runError} onRetry={() => setOverrides((o) => ({ ...o }))} />}
      {runError && result && <Alert kind="error">Latest run failed: {runError}. Showing the previous result.</Alert>}

      {result && baseline && (
        <>
          {/* Guided Decision Summary for Non-Technical Planner */}
          <GuidedDecisionSummary
            result={result}
            recommended={recommended ?? strategies[0]}
            baseline={baseline}
            onAdopt={() => {
              setSelectedKey(recommended?.key ?? result.recommended_key);
              setConfirmAdopt(true);
            }}
            hasAdoptedPlan={decisions.some((d) => d.status === 'adopted')}
            adoptedPlanName={decisions.find((d) => d.status === 'adopted')?.strategy_name}
            isCustomSimulated={delayDays !== result.reported_delay_days || Object.keys(overrides).length > 0}
          />

          {/* Strategy cards */}
          <section aria-label="Recovery strategies">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Compare recovery strategies</h2>
              {recommended && (
                <span className="flex items-center gap-1 text-xs text-emerald-700"><Star className="h-3.5 w-3.5" aria-hidden /> Recommended: {recommended.name}</span>
              )}
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-5 ${running ? 'opacity-70 transition-opacity' : ''}`}>
              {strategies.map((s) => {
                const active = s.key === (selectedKey ?? result.recommended_key);
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedKey(s.key)}
                    aria-pressed={active}
                    className={`flex flex-col rounded-lg border bg-white p-4 text-left shadow-card transition-colors ${active ? 'border-sky-600 ring-1 ring-sky-600' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                      {s.recommended && <Star className="h-4 w-4 flex-shrink-0 fill-emerald-500 text-emerald-600" aria-label="Recommended" />}
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><dt className="text-slate-500">Added cost</dt><dd className="font-medium tabular-nums text-slate-900">{fmtMoney(s.added_cost)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Supply delay</dt><dd className="font-medium tabular-nums text-slate-900">{s.remaining_delay_days} d</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Units short</dt><dd className={`font-medium tabular-nums ${s.shortage_units_immediate > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtNumber(s.shortage_units_immediate)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Late orders</dt><dd className={`font-medium tabular-nums ${s.late_orders_count > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{s.late_orders_count} / {s.affected_orders_count}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Protected</dt><dd className="font-medium tabular-nums text-slate-900">{s.protected_commitments}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Penalties left</dt><dd className={`font-medium tabular-nums ${s.remaining_sla_penalties > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtMoney(s.remaining_sla_penalties)}</dd></div>
                    </dl>
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Total exposure</span><span className="font-semibold tabular-nums text-slate-900">{fmtMoney(s.total_exposure)}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-slate-500">Net vs baseline</span><span className={`font-semibold tabular-nums ${s.net_benefit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{s.key === 'baseline' ? '—' : `${s.net_benefit >= 0 ? '+' : '−'}${fmtMoney(Math.abs(s.net_benefit))}`}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Charts */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Cost versus remaining penalties" subtitle="Lower total bar is better. Added cost is money spent; penalties are what customers can still charge.">
              <ExposureChart strategies={strategies} selectedKey={selectedKey ?? result.recommended_key} onSelect={(k) => setSelectedKey(k as StrategyKey)} />
            </Card>
            <Card title="Delivery impact" subtitle="Remaining supply delay, orders still finishing late, and commitments protected.">
              <DeliveryChart strategies={strategies} selectedKey={selectedKey ?? result.recommended_key} onSelect={(k) => setSelectedKey(k as StrategyKey)} />
            </Card>
          </div>

          {/* Comparison table */}
          <Card title="Side-by-side comparison" bodyClassName="p-0">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Strategy comparison</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-2.5">Metric</th>
                    {strategies.map((s) => (
                      <th key={s.key} scope="col" className={`px-4 py-2.5 text-right ${s.key === (selectedKey ?? result.recommended_key) ? 'text-sky-800' : ''}`}>{s.name.split(':')[0]}{s.recommended ? ' ★' : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {([
                    ['Added recovery cost', (s: StrategyOutcome) => fmtMoney(s.added_cost)],
                    ['Remaining supply delay', (s: StrategyOutcome) => `${s.remaining_delay_days} days`],
                    ['Days recovered', (s: StrategyOutcome) => `${s.days_saved} days`],
                    ['Material shortage after free stock', (s: StrategyOutcome) => `${fmtNumber(s.shortage_units_immediate)} units`],
                    ['Affected production orders', (s: StrategyOutcome) => `${s.affected_orders_count}`],
                    ['Orders finishing late', (s: StrategyOutcome) => `${s.late_orders_count}`],
                    ['Protected customer commitments', (s: StrategyOutcome) => `${s.protected_commitments}`],
                    ['Remaining SLA penalties', (s: StrategyOutcome) => fmtMoney(s.remaining_sla_penalties)],
                    ['SLA penalties avoided', (s: StrategyOutcome) => fmtMoney(s.penalties_avoided)],
                    ['Revenue still at risk', (s: StrategyOutcome) => fmtMoney(s.revenue_at_risk)],
                    ['Total exposure (cost + penalties)', (s: StrategyOutcome) => fmtMoney(s.total_exposure)],
                    ['Net benefit vs baseline', (s: StrategyOutcome) => (s.key === 'baseline' ? '—' : `${s.net_benefit >= 0 ? '+' : '−'}${fmtMoney(Math.abs(s.net_benefit))}`)],
                  ] as Array<[string, (s: StrategyOutcome) => string]>).map(([label, fn]) => (
                    <tr key={label} className="hover:bg-slate-50">
                      <th scope="row" className="px-4 py-2 text-left font-medium text-slate-700">{label}</th>
                      {strategies.map((s) => (
                        <td key={s.key} className={`px-4 py-2 text-right ${s.key === (selectedKey ?? result.recommended_key) ? 'bg-sky-50/60 font-medium text-slate-900' : 'text-slate-700'}`}>{fn(s)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Decision */}
          {current && (
            <Card
              title="Decision summary"
              subtitle={result.summary}
              action={
                selected?.status === 'resolved' ? (
                  <Badge tone="success">Disruption resolved</Badge>
                ) : (
                  <Button onClick={() => setConfirmAdopt(true)} disabled={running}>
                    {decisions.some((d) => d.status === 'adopted') ? 'Replace adopted plan' : 'Adopt this plan'}
                  </Button>
                )
              }
            >
              {decisions.some((d) => d.status === 'adopted') && (
                <Alert kind="success" className="mb-4" title={`Adopted: ${decisions.find((d) => d.status === 'adopted')!.strategy_name}`}>
                  Recorded by {decisions.find((d) => d.status === 'adopted')!.decided_by_name ?? 'unknown'} · {fmtDate(decisions.find((d) => d.status === 'adopted')!.decided_at)}. Adopting another plan supersedes it.
                </Alert>
              )}
              <DecisionSummary strategy={current} baseline={baseline} />
            </Card>
          )}

          <Card title={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><History className="h-4 w-4 text-slate-500" aria-hidden /> Decision log for {result.po_number}</span>} bodyClassName="p-0">
            <DecisionLog decisions={decisions} />
          </Card>
        </>
      )}

      <Modal
        open={confirmAdopt}
        onClose={() => setConfirmAdopt(false)}
        title={isDemo ? 'Adopt recovery plan (Demo Mode)' : 'Adopt recovery plan'}
        description={`${current?.name ?? ''} for ${result?.po_number ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAdopt(false)} disabled={adopting}>Cancel</Button>
            <Button onClick={adopt} isLoading={adopting}>{isDemo ? 'Adopt plan (Demo)' : 'Adopt plan'}</Button>
          </>
        }
      >
        {current && (
          <div className="space-y-4 text-sm text-slate-700">
            {isDemo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                <strong>Hackathon Demo Mode:</strong> Adopting this plan updates your demo session state in the browser and marks this disruption as mitigated without requiring a backend database.
              </div>
            )}
            <p>
              This records the plan with the current inputs ({delayDays ?? result?.simulated_delay_days} day delay{Object.keys(overrides).length ? `, ${Object.keys(overrides).length} custom assumption(s)` : ''}) and its expected outcome: {fmtMoney(current.added_cost)} added cost, {fmtMoney(current.penalties_avoided)} penalties avoided, {current.late_orders_count} order(s) still late.
              {current.key !== 'baseline' ? ' The disruption will be marked mitigated and leave the active risk figures.' : ' Accepting the delay keeps the disruption active.'}
            </p>
            <div>
              <label htmlFor="decision-note" className="mb-1 block text-xs font-medium text-slate-700">Decision note (optional)</label>
              <textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Carrier confirmed capacity, PO amended, customer informed…" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
