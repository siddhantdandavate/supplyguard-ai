import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { api } from '../../services/api';
import { DashboardSummary } from '../../types/api';

export const AppShell: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => {
    const titles: Array<[RegExp, string]> = [
      [/^\/$/, 'Control Center'], [/^\/disruptions\/\d+/, 'Disruption'], [/^\/disruptions/, 'Disruptions'], [/^\/war-room/, 'What-If War Room'],
      [/^\/orders/, 'Production Orders'], [/^\/inventory/, 'Inventory'], [/^\/suppliers/, 'Suppliers'], [/^\/customers/, 'Customers'], [/^\/settings/, 'Settings'],
    ];
    const t = titles.find(([re]) => re.test(pathname))?.[1];
    document.title = t ? `${t} · SupplyGuard AI` : 'SupplyGuard AI — Production Rescue Planner';
  }, [pathname]);

  // Lightweight shell data: disruption counts for the sidebar, next actions for the bell.
  useEffect(() => {
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
  }, [pathname]);

  const active = summary?.disruptions.filter((d) => d.status === 'active') ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} activeDisruptions={active.length} criticalDisruptions={active.filter((d) => d.impact_severity === 'critical').length} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} notifications={summary?.next_actions ?? []} notificationsLoading={summaryLoading} />
        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            {summary?.demo_data && (
              <div className="mb-4 rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Demonstration data.</span> All suppliers, orders and customers shown are seeded demo records for the hackathon walkthrough.
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
