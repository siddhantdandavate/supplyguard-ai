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
  SystemInfo,
  User,
} from '../types/api';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const BASE_URL = `${API_ORIGIN}/api`;
export const TOKEN_KEY = 'supplyguard_token';

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
    else localStorage.removeItem(TOKEN_KEY);
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
  if (auth && token) headers.Authorization = `Bearer ${token}`;

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

export const api = {
  // Health & system
  checkHealth: () => request<{ status: string }>('/health', {}, false),
  getSystemInfo: () => request<SystemInfo>('/system/info'),

  // Auth
  login: (credentials: LoginCredentials) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }, false),
  register: (data: RegisterCredentials) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }, false),
  getMe: () => request<User>('/auth/me'),
  updateMe: (full_name: string) => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify({ full_name }) }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),

  // Dashboard
  getDashboard: () => request<DashboardSummary>('/dashboard/summary'),

  // Disruptions
  getDisruptions: (params?: { status?: DisruptionStatus; severity?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.severity) q.set('severity', params.severity);
    const qs = q.toString();
    return request<DisruptionSummary[]>(`/disruptions${qs ? `?${qs}` : ''}`);
  },
  getDisruptionDetail: (id: number) => request<DisruptionDetail>(`/disruptions/${id}`),
  getShipmentDelays: () => request<ShipmentDelay[]>('/disruptions/delays'),
  updateDisruptionStatus: (id: number, status: DisruptionStatus) =>
    request<ShipmentDelay>(`/disruptions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  reportDisruption: (payload: DisruptionCreate) =>
    request<DisruptionSummary>('/disruptions', { method: 'POST', body: JSON.stringify(payload) }),
  getDecisions: (limit = 20) => request<RecoveryDecision[]>(`/disruptions/decisions?limit=${limit}`),
  getDisruptionDecisions: (id: number) => request<RecoveryDecision[]>(`/disruptions/${id}/decisions`),
  adoptDecision: (id: number, payload: { strategy_key: string; delay_days: number | null; assumptions?: ScenarioAssumptionOverrides; note?: string; mark_mitigated?: boolean }) =>
    request<RecoveryDecision>(`/disruptions/${id}/decisions`, { method: 'POST', body: JSON.stringify({ ...payload, assumptions: payload.assumptions ?? {} }) }),

  // Scenarios
  getStrategies: () => request<StrategyInfo[]>('/scenarios/strategies'),
  simulate: (delayId: number, delayDays: number | null, assumptions?: ScenarioAssumptionOverrides) =>
    request<ScenarioResponse>('/scenarios/simulate', {
      method: 'POST',
      body: JSON.stringify({ delay_id: delayId, delay_days: delayDays, assumptions: assumptions ?? {} }),
    }),

  // Orders
  getOrders: () => request<ProductionOrder[]>('/orders'),
  getOrder: (id: number) => request<ProductionOrder>(`/orders/${id}`),
  updateOrderStatus: (id: number, status: OrderStatus) =>
    request<ProductionOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Inventory & materials
  getInventory: (lowStockOnly = false) => request<Inventory[]>(`/inventory${lowStockOnly ? '?low_stock_only=true' : ''}`),
  updateInventory: (id: number, patch: Partial<Pick<Inventory, 'current_stock' | 'reserved_stock' | 'reorder_point' | 'location'>>) =>
    request<Inventory>(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  getMaterials: () => request<Material[]>('/materials'),

  // Suppliers & customers
  getSuppliers: () => request<SupplierDetail[]>('/suppliers'),
  getSupplier: (id: number) => request<SupplierDetail>(`/suppliers/${id}`),
  createSupplier: (payload: SupplierCreate) => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
  getCustomers: () => request<CustomerDetail[]>('/customers'),
  getCustomer: (id: number) => request<CustomerDetail>(`/customers/${id}`),
  createCustomer: (payload: CustomerCreate) => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) }),
};

export type { Supplier, Customer };
