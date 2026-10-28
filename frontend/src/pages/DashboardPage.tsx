import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, Boxes, ClipboardList, DollarSign, RefreshCw, ShieldCheck, SlidersHorizontal, Truck, Users, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { CriticalOrderSummary, DisruptionSummary } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge, riskTone, statusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataState, EmptyState } from '../components/ui/States';
import { Table, Column } from '../components/ui/Table';
import { Timeline } from '../components/dashboard/Timeline';
import { ExposureByDisruptionChart } from '../components/dashboard/ExposureChart';
import { DecisionLog } from '../components/warroom/DecisionLog';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, relativeDays, titleCase } from '../lib/format';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(() => api.getDashboard(), []);

  const active = data?.disruptions.filter((d) => d.status === 'active') ?? [];
  const headline = [...active].sort((a, b) => b.sla_penalty_exposure - a.sla_penalty_exposure)[0];
  const m = data?.metrics;

  const orderColumns: Column<CriticalOrderSummary>[] = [
    { key: 'order', header: 'Order', render: (o) => <span className="font-medium text-slate-900">{o.order_number}</span>, sortValue: (o) => o.order_number },
    { key: 'customer', header: 'Customer', render: (o) => (<span><span className="block text-slate-900">{o.customer_name}</span><span className="block text-xs text-slate-500">{o.customer_tier}</span></span>), sortValue: (o) => o.customer_name },
    { key: 'product', header: 'Product', render: (o) => <span className="text-slate-700">{o.product_name} <span className="text-slate-400">× {o.quantity}</span></span> },
    { key: 'due', header: 'Committed', render: (o) => (<span><span className="block">{fmtDate(o.committed_delivery_date)}</span><span className="block text-xs text-slate-500">{relativeDays(o.committed_delivery_date)}</span></span>), sortValue: (o) => o.committed_delivery_date },
    { key: 'late', header: 'Projected', render: (o) => o.late_days > 0 ? (<span><span className="block text-rose-700">{fmtDate(o.projected_completion_date)}</span><span className="block text-xs text-rose-600">{o.late_days} days late</span></span>) : <span className="text-emerald-700">On time</span>, sortValue: (o) => o.late_days, align: 'left' },
    { key: 'penalty', header: 'SLA penalty', render: (o) => <span className={o.sla_penalty > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}>{fmtMoney(o.sla_penalty)}</span>, sortValue: (o) => o.sla_penalty, align: 'right' },
    { key: 'risk', header: 'Risk', render: (o) => <Badge tone={riskTone(o.risk_level)}>{titleCase(o.risk_level)}</Badge>, sortValue: (o) => ({ critical: 0, high: 1, medium: 2, low: 3 })[o.risk_level] },
    { key: 'blocker', header: 'Blocked by', render: (o) => o.blocking_po_number ? <Link to={`/disruptions/${o.blocking_disruption_id}`} className="text-sky-700 hover:underline" onClick={(e) => e.stopPropagation()}>{o.blocking_po_number}</Link> : <span className="text-slate-400">—</span> },
  ];

  const disruptionColumns: Column<DisruptionSummary>[] = [
    { key: 'po', header: 'Shipment', render: (d) => (<span><span className="block font-medium text-slate-900">{d.po_number}</span><span className="block text-xs text-slate-500">{d.supplier_name}</span></span>), sortValue: (d) => d.po_number },
    { key: 'material', header: 'Material', render: (d) => (<span><span className="block">{d.material_name}</span><span className="block text-xs text-slate-500">{d.material_sku} · {fmtNumber(d.quantity_delayed)} units</span></span>) },
    { key: 'delay', header: 'Delay', render: (d) => <span className="font-medium text-slate-900">+{d.delay_days} days</span>, sortValue: (d) => d.delay_days, align: 'right' },
    { key: 'orders', header: 'Late orders', render: (d) => <span>{d.late_orders_count} <span className="text-slate-400">of {d.affected_orders_count}</span></span>, sortValue: (d) => d.late_orders_count, align: 'right' },
    { key: 'exposure', header: 'Penalty exposure', render: (d) => <span className={d.sla_penalty_exposure > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}>{fmtMoney(d.sla_penalty_exposure)}</span>, sortValue: (d) => d.sla_penalty_exposure, align: 'right' },
    { key: 'severity', header: 'Severity', render: (d) => <Badge tone={riskTone(d.impact_severity)}>{titleCase(d.impact_severity)}</Badge> },
    { key: 'status', header: 'Status', render: (d) => <Badge tone={statusTone(d.status)}>{titleCase(d.status)}</Badge> },
    { key: 'reported', header: 'Reported', render: (d) => <span className="text-slate-500">{fmtDateTime(d.reported_at)}</span>, sortValue: (d) => d.reported_at },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Control Center"
        description="What is wrong, how severe it is, which orders are affected, and what to do next."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => reload()} isLoading={loading && !!data}>
            Refresh
          </Button>
        }
      />

      <DataState loading={loading && !data} error={error} onRetry={() => reload()} loadingRows={6}>
        {data && m && (
          <>
            {/* 1. What is wrong */}
            {headline ? (
              <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-card" aria-labelledby="headline-title">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-rose-50 p-2 text-rose-700">
                      <AlertOctagon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={riskTone(headline.impact_severity)}>{titleCase(headline.impact_severity)} disruption</Badge>
                        <span className="text-xs text-slate-500">{headline.po_number} · {headline.supplier_name}</span>
                      </div>
                      <h2 id="headline-title" className="mt-1 text-base font-semibold text-slate-900">
                        {headline.material_name} is {headline.delay_days} days late; {headline.late_orders_count} of {headline.affected_orders_count} affected orders will miss their commitment.
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {fmtNumber(headline.shortage_units)} units short after using free stock. Exposure {fmtMoney(headline.sla_penalty_exposure)} in SLA penalties and {fmtMoney(headline.revenue_at_risk)} of revenue across {headline.customers_at_risk} customer{headline.customers_at_risk === 1 ? '' : 's'}.
                        {headline.recommended_strategy && (
                          <> Recommended: <span className="font-medium text-slate-800">{headline.recommended_strategy}</span> for {fmtMoney(headline.recommended_cost)} avoiding {fmtMoney(headline.recommended_penalties_avoided)}.</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/disruptions/${headline.id}`)}>
                      Review impact
                    </Button>
                    <Button icon={SlidersHorizontal} onClick={() => navigate(`/war-room/${headline.id}`)}>
                      Open What-If War Room
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-5 shadow-card">
                <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">No active supplier disruptions</h2>
                  <p className="text-sm text-slate-600">All open production orders are covered by current stock and scheduled deliveries.</p>
                </div>
              </section>
            )}

            {/* 2. How severe */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Orders at risk" value={m.orders_at_risk} hint={`of ${m.orders_total} open orders`} icon={ClipboardList} tone={m.orders_at_risk > 0 ? 'critical' : 'success'} to="/orders" />
              <StatCard label="Critical shortages" value={m.critical_shortages} hint={`${m.low_stock_items} low-stock SKUs`} icon={Boxes} tone={m.critical_shortages > 0 ? 'critical' : m.low_stock_items > 0 ? 'warning' : 'success'} to="/inventory" />
              <StatCard label="Delayed shipments" value={m.delayed_shipments} hint={`${m.critical_shipments} critical`} icon={Truck} tone={m.critical_shipments > 0 ? 'critical' : m.delayed_shipments > 0 ? 'warning' : 'success'} to="/disruptions" />
              <StatCard label="Commitments at risk" value={m.commitments_at_risk} hint={`of ${m.customers_total} customers`} icon={Users} tone={m.commitments_at_risk > 0 ? 'warning' : 'success'} to="/customers" />
              <StatCard label="SLA penalty exposure" value={fmtMoney(m.sla_penalty_exposure)} hint={`${fmtMoney(m.recoverable_penalties)} recoverable`} icon={DollarSign} tone={m.sla_penalty_exposure > 0 ? 'critical' : 'success'} to={headline ? `/war-room/${headline.id}` : '/war-room'} />
              <StatCard label="Revenue at risk" value={fmtMoney(m.revenue_at_risk)} hint="orders finishing late" icon={DollarSign} tone={m.revenue_at_risk > 0 ? 'warning' : 'success'} to="/orders" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* 4. What next */}
              <Card title="Recommended next actions" subtitle="Ordered by financial exposure" className="lg:col-span-3" bodyClassName="p-0">
                {data.next_actions.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Nothing to do right now" description="No disruptions or stock shortfalls need attention." />
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {data.next_actions.map((a) => (
                      <li key={`${a.priority}-${a.title}`}>
                        <button onClick={() => navigate(a.route)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-slate-50">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{a.priority}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">{a.title}</span>
                              <Badge tone={riskTone(a.severity)} size="sm">{titleCase(a.severity)}</Badge>
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-600">{a.detail}</span>
                          </span>
                          <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <Card title="Disruption timeline" subtitle="Original and revised ETAs against order commitments" className="lg:col-span-2">
                <Timeline events={data.timeline} />
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Card title="SLA exposure by active disruption" subtitle="Click a bar to open the disruption" className="lg:col-span-2">
                <ExposureByDisruptionChart disruptions={data.disruptions} />
              </Card>
              <Card title="Recent recovery decisions" subtitle="Plans adopted in the What-If War Room" className="lg:col-span-3" bodyClassName="p-0">
                <DecisionLog decisions={data.recent_decisions} showDisruption compact />
              </Card>
            </div>

            {/* 3. Which orders */}
            <Card
              title="Production orders needing attention"
              subtitle="Open orders whose material supply is disrupted"
              bodyClassName="p-0"
              action={
                <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline">
                  All orders <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            >
              <Table
                columns={orderColumns}
                rows={data.critical_orders}
                rowKey={(o) => o.id}
                onRowClick={(o) => navigate(`/orders/${o.id}`)}
                caption="Production orders at risk"
                emptyMessage={<EmptyState icon={CheckCircle2} title="No orders at risk" description="Every open order is covered by stock or on-time supply." />}
              />
            </Card>

            <Card
              title="Recent disruptions"
              subtitle="Supplier shipment delays and their computed impact"
              bodyClassName="p-0"
              action={
                <Link to="/disruptions" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline">
                  All disruptions <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            >
              <Table columns={disruptionColumns} rows={data.disruptions.slice(0, 5)} rowKey={(d) => d.id} onRowClick={(d) => navigate(`/disruptions/${d.id}`)} caption="Recent disruptions" emptyMessage={<EmptyState title="No disruptions recorded" />} />
            </Card>

            <p className="text-right text-xs text-slate-400">Computed {fmtDateTime(data.generated_at)} from live inventory, orders and shipment data.</p>
          </>
        )}
      </DataState>
    </div>
  );
};
