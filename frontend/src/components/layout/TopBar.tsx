import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, User as UserIcon, Wifi, WifiOff, AlertOctagon, ClipboardList, Truck, Users, Boxes } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, isDemoMode } from '../../services/api';
import { NextAction } from '../../types/api';
import { Badge } from '../ui/Badge';

interface TopBarProps {
  onMenu: () => void;
  notifications: NextAction[];
  notificationsLoading: boolean;
}

const titles: Array<[RegExp, string]> = [
  [/^\/supplier/, 'Supplier Shipment Workspace'],
  [/^\/$/, 'Production Control Center'],
  [/^\/disruptions\/\d+/, 'Disruption Details'],
  [/^\/disruptions/, 'Disruptions'],
  [/^\/war-room/, 'What-If War Room'],
  [/^\/orders/, 'Production Orders'],
  [/^\/inventory/, 'Inventory'],
  [/^\/suppliers/, 'Suppliers'],
  [/^\/customers/, 'Customers'],
  [/^\/settings/, 'Settings'],
];

interface SearchHit {
  kind: 'order' | 'disruption' | 'supplier' | 'customer' | 'inventory';
  title: string;
  subtitle: string;
  to: string;
}

const kindIcon = { order: ClipboardList, disruption: AlertOctagon, supplier: Truck, customer: Users, inventory: Boxes };

export const TopBar: React.FC<TopBarProps> = ({ onMenu, notifications, notificationsLoading }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const title = titles.find(([re]) => re.test(pathname))?.[1] ?? 'SupplyGuard AI';

  // API connectivity
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const ping = async () => {
      const start = performance.now();
      try {
        await api.checkHealth();
        if (mounted) {
          setApiOnline(true);
          setLatency(Math.round(performance.now() - start));
        }
      } catch {
        if (mounted) setApiOnline(false);
      }
    };
    ping();
    const id = window.setInterval(ping, 15000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  // Search
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const indexRef = useRef<SearchHit[] | null>(null);
  const searchBox = useRef<HTMLDivElement>(null);

  const isSupplier = user?.role === 'supplier';

  const buildIndex = async (): Promise<SearchHit[]> => {
    if (indexRef.current) return indexRef.current;
    if (isSupplier) {
      try {
        const shipments = await api.getSupplierShipments();
        const idx: SearchHit[] = shipments.map((s) => ({
          kind: 'disruption' as const,
          title: `${s.po_number} · ${s.material?.name ?? 'Assigned Material'}`,
          subtitle: `${s.quantity_delayed} units · Status: ${s.status.replace('_', ' ')} · ETA: ${s.revised_eta}`,
          to: '/supplier',
        }));
        indexRef.current = idx;
        return idx;
      } catch {
        return [];
      }
    }
    const [orders, disruptions, suppliers, customers, inventory] = await Promise.all([
      api.getOrders(),
      api.getDisruptions(),
      api.getSuppliers(),
      api.getCustomers(),
      api.getInventory(),
    ]);
    const idx: SearchHit[] = [
      ...orders.map((o) => ({ kind: 'order' as const, title: `${o.order_number} · ${o.product_name}`, subtitle: `${o.customer?.name ?? ''} · ${o.status.replace('_', ' ')}`, to: `/orders/${o.id}` })),
      ...disruptions.map((d) => ({ kind: 'disruption' as const, title: `${d.po_number} · ${d.material_name}`, subtitle: `${d.supplier_name} · +${d.delay_days} days · ${d.status}`, to: `/disruptions/${d.id}` })),
      ...suppliers.map((s) => ({ kind: 'supplier' as const, title: s.name, subtitle: `${s.code} · ${s.location ?? ''}`, to: `/suppliers/${s.id}` })),
      ...customers.map((c) => ({ kind: 'customer' as const, title: c.name, subtitle: `${c.code} · ${c.tier}`, to: `/customers/${c.id}` })),
      ...inventory.map((i) => ({ kind: 'inventory' as const, title: `${i.material?.sku ?? ''} · ${i.material?.name ?? ''}`, subtitle: `${i.available_stock} available · ${i.stock_status}`, to: `/inventory?q=${encodeURIComponent(i.material?.sku ?? '')}` })),
    ];
    indexRef.current = idx;
    return idx;
  };

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const idx = await buildIndex();
        const q = query.toLowerCase();
        if (!cancelled) setHits(idx.filter((h) => h.title.toLowerCase().includes(q) || h.subtitle.toLowerCase().includes(q)).slice(0, 8));
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchBox.current && !searchBox.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Menus
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menus.current && !menus.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const urgent = useMemo(() => notifications.filter((n) => n.severity === 'critical' || n.severity === 'high').length, [notifications]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenu} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <div ref={searchBox} className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search orders, POs, SKUs, suppliers…"
            aria-label="Global search"
            className="h-9 w-72 rounded-md border border-slate-300 bg-slate-50 pl-8 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          {searchOpen && query.trim() && (
            <div className="absolute right-0 mt-1 w-96 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg" role="listbox">
              {searching && hits.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">Searching…</div>
              ) : hits.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">No matches for “{query}”.</div>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {hits.map((h) => {
                    const Icon = kindIcon[h.kind];
                    return (
                      <li key={`${h.kind}-${h.to}-${h.title}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setSearchOpen(false);
                            setQuery('');
                            navigate(h.to);
                          }}
                          className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900">{h.title}</span>
                            <span className="block truncate text-xs text-slate-500">{h.subtitle}</span>
                          </span>
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">{h.kind}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Hackathon Demo Notice */}
        {isDemoMode() ? (
          <div
            className="hidden items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm sm:flex"
            title="Demonstration session running with seeded scenario calculations"
            role="status"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            <span>Hackathon Demo Mode — using demonstration data</span>
          </div>
        ) : (
          <div
            className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium sm:flex ${
              apiOnline === null ? 'border-slate-200 text-slate-500' : apiOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
            title={apiOnline ? `API reachable · ${latency ?? '?'} ms` : apiOnline === false ? 'API unreachable' : 'Checking API'}
            role="status"
          >
            {apiOnline === false ? <WifiOff className="h-3.5 w-3.5" aria-hidden /> : <Wifi className="h-3.5 w-3.5" aria-hidden />}
            <span>{apiOnline === null ? 'Checking' : apiOnline ? `API online${latency != null ? ` · ${latency} ms` : ''}` : 'API offline'}</span>
          </div>
        )}

        <div ref={menus} className="flex items-center gap-1">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                setProfileOpen(false);
              }}
              className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label={`Notifications${notifications.length ? `, ${notifications.length} items` : ''}`}
              aria-expanded={notifOpen}
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${urgent ? 'bg-rose-600' : 'bg-sky-600'}`}>
                  {notifications.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-1 w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg sm:w-96">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">Recommended actions</span>
                  <Link to="/" onClick={() => setNotifOpen(false)} className="text-xs text-sky-700 hover:underline">
                    Open control center
                  </Link>
                </div>
                {notificationsLoading ? (
                  <div className="px-3 py-3 text-sm text-slate-500">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">No open actions. Operations look healthy.</div>
                ) : (
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={`${n.priority}-${n.title}`}>
                        <button
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(n.route);
                          }}
                          className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
                        >
                          <Badge tone={n.severity === 'critical' ? 'critical' : n.severity === 'high' ? 'high' : 'medium'} size="sm">
                            {n.severity}
                          </Badge>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                            <span className="block text-xs text-slate-500">{n.detail}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen((o) => !o);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100"
              aria-label="Account menu"
              aria-expanded={profileOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold uppercase text-white" aria-hidden>
                {user?.full_name?.split(' ').map((p) => p[0]).slice(0, 2).join('') || '?'}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-900">{user?.full_name}</span>
                <span className="block text-[11px] capitalize leading-tight text-slate-500">{user?.role}</span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2">
                  <div className="truncate text-sm font-medium text-slate-900">{user?.full_name}</div>
                  <div className="truncate text-xs text-slate-500">{user?.email}</div>
                </div>
                <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <UserIcon className="h-4 w-4 text-slate-400" aria-hidden /> Profile
                </Link>
                <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings className="h-4 w-4 text-slate-400" aria-hidden /> Settings
                </Link>
                <button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
