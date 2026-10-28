import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertOctagon,
  SlidersHorizontal,
  ClipboardList,
  Boxes,
  Truck,
  Users,
  Settings,
  ShieldAlert,
  LogOut,
  X,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
  activeDisruptions: number;
  criticalDisruptions: number;
}

const plannerNavItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/disruptions', label: 'Disruptions', icon: AlertOctagon },
  { to: '/war-room', label: 'What-If War Room', icon: SlidersHorizontal, highlight: true },
  { to: '/orders', label: 'Production Orders', icon: ClipboardList },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const supplierNavItems = [
  { to: '/supplier', label: 'Assigned Shipments', icon: Package, end: true, highlight: true },
  { to: '/settings', label: 'Account & Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose, activeDisruptions, criticalDisruptions }) => {
  const { user, logout } = useAuth();
  const isSupplier = user?.role === 'supplier';
  const navItems = isSupplier ? supplierNavItems : plannerNavItems;

  const content = (
    <div className={`flex h-full flex-col text-slate-300 ${isSupplier ? 'bg-slate-900 border-r border-slate-800' : 'bg-navy-900'}`}>
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <Link to={isSupplier ? '/supplier' : '/'} className="flex items-center gap-2.5" onClick={onClose}>
          <div className={`rounded-md p-1.5 text-white ${isSupplier ? 'bg-indigo-600' : 'bg-sky-600'}`}>
            <ShieldAlert className="h-4 w-4" aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">SupplyGuard AI</div>
            <div className="text-[11px] text-slate-400">
              {isSupplier ? 'Supplier Portal' : 'Production Rescue Planner'}
            </div>
          </div>
        </Link>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>

      {isSupplier && (
        <div className="m-3 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs">
          <div className="font-semibold text-indigo-300">Supplier Workspace</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Restricted carrier shipment view</div>
        </div>
      )}

      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {isSupplier ? 'Portal Navigation' : 'Operations'}
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    } ${item.highlight ? 'mt-1 mb-1' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3">
                        <span className={`h-5 w-0.5 rounded-full ${isActive ? (isSupplier ? 'bg-indigo-400' : 'bg-sky-400') : 'bg-transparent'}`} aria-hidden />
                        <Icon className={`h-4 w-4 ${item.highlight ? (isSupplier ? 'text-indigo-400' : 'text-sky-400') : isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} aria-hidden />
                        <span>{item.label}</span>
                      </span>
                      {item.to === '/disruptions' && activeDisruptions > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${criticalDisruptions > 0 ? 'bg-rose-500/20 text-rose-200' : 'bg-amber-500/20 text-amber-200'}`}
                          aria-label={`${activeDisruptions} active disruptions`}
                        >
                          {activeDisruptions}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase text-white ${isSupplier ? 'bg-indigo-700' : 'bg-sky-700'}`} aria-hidden>
              {user?.full_name?.split(' ').map((p) => p[0]).slice(0, 2).join('') || '?'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.full_name}</div>
              <div className="truncate text-[11px] capitalize text-slate-400">
                {isSupplier ? 'Supplier · Apex Sensors' : user?.role}
              </div>
            </div>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full w-60 flex-shrink-0 lg:block">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
};
