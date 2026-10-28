import {
  AuthResponse,
  Customer,
  CustomerCreate,
  CustomerDetail,
  DashboardSummary,
  DisruptionCreate,
  DisruptionDetail,
  DisruptionStatus,
  DisruptionSummary,
  Inventory,
  LoginCredentials,
  Material,
  OrderStatus,
  ProductionOrder,
  RecoveryDecision,
  RegisterCredentials,
  ScenarioAssumptionOverrides,
  ScenarioResponse,
  ShipmentDelay,
  StrategyInfo,
  Supplier,
  SupplierCreate,
  SupplierDetail,
  SupplierShipmentUpdatePayload,
  SystemInfo,
  User,
} from '../types/api';
import {
  demoAdoptDecision,
  demoGetCustomers,
  demoGetDashboard,
  demoGetDisruptionDetail,
  demoGetDisruptions,
  demoGetStrategies,
  demoGetSupplierShipments,
  demoGetSuppliers,
  demoLogin,
  demoUpdateSupplierShipment,
  getDemoActiveUser,
  getDemoState,
  saveDemoState,
  setDemoActiveUser,
} from './demoData';
import { simulateInDemo } from './demoEngine';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const BASE_URL = `${API_ORIGIN}/api`;
export const TOKEN_KEY = 'supplyguard_token';
export const DEMO_MODE_KEY = 'supplyguard_demo_mode';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export function isDemoMode(): boolean {
  try {
    if (localStorage.getItem(DEMO_MODE_KEY) === 'true') return true;
    if (localStorage.getItem(TOKEN_KEY) === 'demo-token') return true;
  } catch {
    // ignore
  }
  return !API_ORIGIN;
}

export function setDemoMode(active: boolean) {
  try {
    if (active) localStorage.setItem(DEMO_MODE_KEY, 'true');
    else localStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // ignore
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else {
      localStorage.removeItem(TOKEN_KEY);
      setDemoActiveUser(null);
    }
  } catch {
    // storage unavailable; session will not persist
  }
}

function formatValidationError(detail: unknown): string {
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg ?? 'invalid value'}` : d.msg ?? 'Invalid value';
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  return 'Request failed';
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (auth && token && token !== 'demo-token') headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(`Cannot reach the SupplyGuard API at ${BASE_URL}. Check that the backend is running and reachable.`, 0);
  }

  if (res.status === 401 && auth) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.detail !== undefined) message = formatValidationError(body.detail);
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Executes a network call when configured and reachable.
 * Seamlessly falls back to local demonstration calculations if the backend is unavailable or returns 404.
 */
async function withDemoFallback<T>(networkFn: () => Promise<T>, demoFn: () => T | Promise<T>): Promise<T> {
  if (isDemoMode() || !API_ORIGIN) {
    return Promise.resolve(demoFn());
  }
  try {
    return await networkFn();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 0 || err.status === 502 || err.status === 503)) {
      setDemoMode(true);
      return Promise.resolve(demoFn());
    }
    throw err;
  }
}

const DEMO_EMAILS = [
  'planner@supplyguard.io',
  'admin@supplyguard.io',
  'supplier@apexsensors.example',
];

export const api = {
  // Health & system
  checkHealth: () =>
    withDemoFallback(
      () => request<{ status: string }>('/health', {}, false),
      () => ({ status: 'ok (demo mode)' }),
    ),

  getSystemInfo: () =>
    withDemoFallback(
      () => request<SystemInfo>('/system/info'),
      (): SystemInfo => ({
        app_name: 'SupplyGuard AI',
        version: '1.2.0-demo',
        api_prefix: '/api',
        database_dialect: 'In-Memory Demo State',
        database_target: 'Hackathon Demo Mode',
        using_sqlite_fallback: true,
        demo_data: true,
        auth: 'Demonstration Session',
        token_lifetime_minutes: 1440,
      }),
    ),

  // Auth
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const isDemoEmail = DEMO_EMAILS.includes(credentials.email.trim().toLowerCase());
    if (isDemoEmail || isDemoMode() || !API_ORIGIN) {
      setDemoMode(true);
      const user = demoLogin(credentials.email);
      return {
        access_token: 'demo-token',
        token_type: 'bearer',
        user,
      };
    }

    try {
      return await request<AuthResponse>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(credentials) },
        false,
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 0 || err.status === 502 || err.status === 503)) {
        setDemoMode(true);
        const user = demoLogin(credentials.email);
        return {
          access_token: 'demo-token',
          token_type: 'bearer',
          user,
        };
      }
      throw err;
    }
  },

  register: async (data: RegisterCredentials): Promise<AuthResponse> => {
    if (isDemoMode() || !API_ORIGIN) {
      setDemoMode(true);
      const user = demoLogin(data.email);
      user.full_name = data.full_name;
      user.role = (data.role as any) ?? 'planner';
      return {
        access_token: 'demo-token',
        token_type: 'bearer',
        user,
      };
    }
    return withDemoFallback(
      () => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }, false),
      () => {
        setDemoMode(true);
        const user = demoLogin(data.email);
        user.full_name = data.full_name;
        user.role = (data.role as any) ?? 'planner';
        return {
          access_token: 'demo-token',
          token_type: 'bearer',
          user,
        };
      },
    );
  },

  getMe: (): Promise<User> =>
    withDemoFallback(
      () => request<User>('/auth/me'),
      () => getDemoActiveUser() ?? demoLogin('planner@supplyguard.io'),
    ),

  updateMe: (full_name: string) =>
    withDemoFallback(
      () => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name }) }),
      () => {
        const u = getDemoActiveUser() ?? demoLogin('planner@supplyguard.io');
        u.full_name = full_name;
        setDemoActiveUser(u);
        return u;
      },
    ),

  changePassword: (current_password: string, new_password: string) =>
    withDemoFallback(
      () => request<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
      () => undefined,
    ),

  // Dashboard
  getDashboard: () =>
    withDemoFallback(
      () => request<DashboardSummary>('/dashboard/summary'),
      () => demoGetDashboard(),
    ),

  // Disruptions
  getDisruptions: (params?: { status?: DisruptionStatus; severity?: string }) =>
    withDemoFallback(
      () => {
        const q = new URLSearchParams();
        if (params?.status) q.set('status', params.status);
        if (params?.severity) q.set('severity', params.severity);
        const qs = q.toString();
        return request<DisruptionSummary[]>(`/disruptions${qs ? `?${qs}` : ''}`);
      },
      () => {
        let all = demoGetDisruptions();
        if (params?.status) all = all.filter((d) => d.status === params.status);
        if (params?.severity) all = all.filter((d) => d.impact_severity === params.severity);
        return all;
      },
    ),

  getDisruptionDetail: (id: number) =>
    withDemoFallback(
      () => request<DisruptionDetail>(`/disruptions/${id}`),
      () => demoGetDisruptionDetail(id),
    ),

  getShipmentDelays: () =>
    withDemoFallback(
      () => request<ShipmentDelay[]>('/disruptions/delays'),
      () => getDemoState().delays,
    ),

  updateDisruptionStatus: (id: number, status: DisruptionStatus) =>
    withDemoFallback(
      () => request<ShipmentDelay>(`/disruptions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      () => {
        const state = getDemoState();
        const d = state.delays.find((x) => x.id === id);
        if (d) {
          d.status = status;
          saveDemoState(state);
          return d;
        }
        throw new ApiError('Disruption not found', 404);
      },
    ),

  reportDisruption: (payload: DisruptionCreate) =>
    withDemoFallback(
      () => request<DisruptionSummary>('/disruptions', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const state = getDemoState();
        const newDelay: ShipmentDelay = {
          id: (state.delays.length > 0 ? Math.max(...state.delays.map((x) => x.id)) : 0) + 1,
          po_number: payload.po_number,
          supplier_id: payload.supplier_id,
          material_id: payload.material_id,
          quantity_delayed: payload.quantity_delayed,
          original_eta: payload.original_eta,
          revised_eta: payload.revised_eta,
          delay_days: 14,
          reason: payload.reason ?? null,
          status: 'active',
          impact_severity: 'critical',
          reported_at: new Date().toISOString(),
        };
        state.delays.unshift(newDelay);
        saveDemoState(state);
        return demoGetDisruptions().find((d) => d.id === newDelay.id)!;
      },
    ),

  getDecisions: (limit = 20) =>
    withDemoFallback(
      () => request<RecoveryDecision[]>(`/disruptions/decisions?limit=${limit}`),
      () => getDemoState().decisions.slice(0, limit),
    ),

  getDisruptionDecisions: (id: number) =>
    withDemoFallback(
      () => request<RecoveryDecision[]>(`/disruptions/${id}/decisions`),
      () => getDemoState().decisions.filter((d) => d.shipment_delay_id === id),
    ),

  adoptDecision: (
    id: number,
    payload: {
      strategy_key: string;
      delay_days: number | null;
      assumptions?: ScenarioAssumptionOverrides;
      note?: string;
      mark_mitigated?: boolean;
    },
  ) =>
    withDemoFallback(
      () =>
        request<RecoveryDecision>(`/disruptions/${id}/decisions`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, assumptions: payload.assumptions ?? {} }),
        }),
      () => demoAdoptDecision(id, payload),
    ),

  // Scenarios (What-If War Room)
  getStrategies: () =>
    withDemoFallback(
      () => request<StrategyInfo[]>('/scenarios/strategies'),
      () => demoGetStrategies(),
    ),

  simulate: (
    delayId: number,
    delayDays: number | null,
    assumptions?: ScenarioAssumptionOverrides,
  ) =>
    withDemoFallback(
      () =>
        request<ScenarioResponse>('/scenarios/simulate', {
          method: 'POST',
          body: JSON.stringify({ delay_id: delayId, delay_days: delayDays, assumptions: assumptions ?? {} }),
        }),
      () => simulateInDemo(getDemoState(), delayId, delayDays, assumptions),
    ),

  // Orders
  getOrders: () =>
    withDemoFallback(
      () => request<ProductionOrder[]>('/orders'),
      () => getDemoState().orders,
    ),

  getOrder: (id: number) =>
    withDemoFallback(
      () => request<ProductionOrder>(`/orders/${id}`),
      () => {
        const o = getDemoState().orders.find((x) => x.id === id);
        if (!o) throw new ApiError('Order not found', 404);
        return o;
      },
    ),

  updateOrderStatus: (id: number, status: OrderStatus) =>
    withDemoFallback(
      () => request<ProductionOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      () => {
        const state = getDemoState();
        const o = state.orders.find((x) => x.id === id);
        if (!o) throw new ApiError('Order not found', 404);
        o.status = status;
        saveDemoState(state);
        return o;
      },
    ),

  // Inventory & materials
  getInventory: (lowStockOnly = false) =>
    withDemoFallback(
      () => request<Inventory[]>(`/inventory${lowStockOnly ? '?low_stock_only=true' : ''}`),
      () => {
        const all = getDemoState().inventory;
        return lowStockOnly ? all.filter((i) => i.available_stock <= i.reorder_point) : all;
      },
    ),

  updateInventory: (
    id: number,
    patch: Partial<Pick<Inventory, 'current_stock' | 'reserved_stock' | 'reorder_point' | 'location'>>,
  ) =>
    withDemoFallback(
      () => request<Inventory>(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
      () => {
        const state = getDemoState();
        const inv = state.inventory.find((x) => x.id === id);
        if (!inv) throw new ApiError('Inventory not found', 404);
        Object.assign(inv, patch);
        inv.available_stock = Math.max(0, inv.current_stock - inv.reserved_stock);
        if (inv.available_stock <= 0) inv.stock_status = 'critical';
        else if (inv.available_stock <= inv.reorder_point) inv.stock_status = 'low';
        else inv.stock_status = 'healthy';
        saveDemoState(state);
        return inv;
      },
    ),

  getMaterials: () =>
    withDemoFallback(
      () => request<Material[]>('/materials'),
      () => getDemoState().materials,
    ),

  // Suppliers & customers
  getSuppliers: () =>
    withDemoFallback(
      () => request<SupplierDetail[]>('/suppliers'),
      () => demoGetSuppliers(),
    ),

  getSupplier: (id: number) =>
    withDemoFallback(
      () => request<SupplierDetail>(`/suppliers/${id}`),
      () => {
        const s = demoGetSuppliers().find((x) => x.id === id);
        if (!s) throw new ApiError('Supplier not found', 404);
        return s;
      },
    ),

  createSupplier: (payload: SupplierCreate) =>
    withDemoFallback(
      () => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const state = getDemoState();
        const newSup: Supplier = {
          id: (state.suppliers.length > 0 ? Math.max(...state.suppliers.map((x) => x.id)) : 0) + 1,
          name: payload.name,
          code: payload.code,
          contact_name: payload.contact_name ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          location: payload.location ?? null,
          lead_time_days: payload.lead_time_days,
          on_time_delivery_rate: payload.on_time_delivery_rate,
          reliability_score: payload.reliability_score,
          created_at: new Date().toISOString(),
        };
        state.suppliers.push(newSup);
        saveDemoState(state);
        return newSup;
      },
    ),

  getCustomers: () =>
    withDemoFallback(
      () => request<CustomerDetail[]>('/customers'),
      () => demoGetCustomers(),
    ),

  getCustomer: (id: number) =>
    withDemoFallback(
      () => request<CustomerDetail>(`/customers/${id}`),
      () => {
        const c = demoGetCustomers().find((x) => x.id === id);
        if (!c) throw new ApiError('Customer not found', 404);
        return c;
      },
    ),

  createCustomer: (payload: CustomerCreate) =>
    withDemoFallback(
      () => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) }),
      () => {
        const state = getDemoState();
        const newCust: Customer = {
          id: (state.customers.length > 0 ? Math.max(...state.customers.map((x) => x.id)) : 0) + 1,
          name: payload.name,
          code: payload.code,
          tier: payload.tier,
          contact_name: payload.contact_name ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          sla_penalty_per_day: payload.sla_penalty_per_day,
          priority_score: payload.priority_score,
          created_at: new Date().toISOString(),
        };
        state.customers.push(newCust);
        saveDemoState(state);
        return newCust;
      },
    ),

  // Supplier Portal
  getSupplierProfile: () =>
    withDemoFallback(
      () => request<Supplier>('/supplier/profile'),
      () => getDemoState().suppliers[0],
    ),

  getSupplierShipments: () =>
    withDemoFallback(
      () => request<ShipmentDelay[]>('/supplier/shipments'),
      () => demoGetSupplierShipments(1),
    ),

  getSupplierShipment: (id: number) =>
    withDemoFallback(
      () => request<ShipmentDelay>(`/supplier/shipments/${id}`),
      () => {
        const s = demoGetSupplierShipments(1).find((x) => x.id === id);
        if (!s) throw new ApiError('Shipment not found', 404);
        return s;
      },
    ),

  updateSupplierShipment: (id: number, payload: SupplierShipmentUpdatePayload) =>
    withDemoFallback(
      () => request<ShipmentDelay>(`/supplier/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      () => demoUpdateSupplierShipment(id, payload as any),
    ),
};

export type { Supplier, Customer };
