import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DashboardSummary } from '../../types/api';

const APP_VERSION = '1.1.0';

export const AppShell: React.FC = () => {
  const { user } = useAuth();
  const isSupplier = user?.role === 'supplier';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { pathname } = useLocation();
  const scroller = useRef<HTMLElement>(null);

  // Page title per route
  useEffect(() => {
    const titles: Array<[RegExp, string]> = [
      [/^\/supplier/, 'Supplier Shipment Workspace'],
      [/^\/$/, 'Control Center'], [/^\/disruptions\/\d+/, 'Disruption'], [/^\/disruptions/, 'Disruptions'], [/^\/war-room/, 'What-If War Room'],
      [/^\/orders/, 'Production Orders'], [/^\/inventory/, 'Inventory'], [/^\/suppliers/, 'Suppliers'], [/^\/customers/, 'Customers'], [/^\/settings/, 'Settings'],
    ];
    const t = titles.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · SupplyGuard AI` : 'SupplyGuard AI — Production Rescue Planner';
  }, [pathname]);

  // Start every page at the top; the main region is the only scroll container.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Lightweight shell data: disruption counts for the sidebar, next actions for the bell.
  useEffect(() => {
    if (isSupplier) {
      setSummaryLoading(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      try {
        const s = await api.getDashboard();
        if (mounted) setSummary(s);
      } catch {
        // keep previous value; TopBar shows API status separately
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 60000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [pathname, isSupplier]);

  const active = summary?.disruptions.filter((d) => d.status === 'active') ?? [];

  return (
    <div className="app-shell fixed inset-0 flex overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeDisruptions={active.length} criticalDisruptions={active.filter((d) => d.impact_severity === 'critical').length} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenu={() => setMobileOpen(true)} notifications={summary?.next_actions ?? []} notificationsLoading={summaryLoading} />
        <main ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div key={pathname} className="animate-fade-in mx-auto flex min-h-full w-full max-w-[1400px] flex-col px-4 pt-6 sm:px-6 lg:px-8">
            {summary?.demo_data && (
              <div className="mb-4 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Demonstration data.</span> All suppliers, orders and customers shown are seeded demo records for the hackathon walkthrough.
              </div>
            )}
            <div className="flex-1">
              <Outlet />
            </div>
            <footer className="mt-10 flex flex-col gap-1 border-t border-slate-200 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>SupplyGuard AI · Production Rescue Planner · v{APP_VERSION}</span>
              <span>Figures are computed live from inventory, orders and shipment data.</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};
