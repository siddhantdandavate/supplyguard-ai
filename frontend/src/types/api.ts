export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium';
export type DisruptionStatus = 'active' | 'mitigated' | 'resolved';
export type OrderStatus = 'scheduled' | 'in_progress' | 'delayed' | 'completed';
export type StockStatus = 'critical' | 'low' | 'healthy';
export type StrategyKey = 'baseline' | 'expedite' | 'alternate' | 'reallocation' | 'combined';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'planner' | 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  full_name: string;
  role?: string;
}

export interface Supplier {
  id: number;
  name: string;
  code: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  lead_time_days: number;
  on_time_delivery_rate: number;
  reliability_score: number;
  created_at: string;
}

export interface Material {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit_of_measure: string;
  unit_cost: number;
  supplier_id: number | null;
  alternate_supplier_id: number | null;
  standard_lead_time_days: number;
  safety_stock: number;
  created_at: string;
  supplier?: Supplier | null;
  alternate_supplier?: Supplier | null;
}

export interface Inventory {
  id: number;
  material_id: number;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  reorder_point: number;
  location: string;
  updated_at: string;
  stock_status: StockStatus;
  material?: Material | null;
}

export interface Customer {
  id: number;
  name: string;
  code: string;
  tier: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  sla_penalty_per_day: number;
  priority_score: number;
  created_at: string;
}

export interface ProductionOrderMaterial {
  id: number;
  material_id: number;
  quantity_required: number;
  quantity_allocated: number;
  material?: Material | null;
}

export interface ProductionOrder {
  id: number;
  order_number: string;
  customer_id: number;
  product_name: string;
  quantity: number;
  status: OrderStatus;
  planned_start_date: string;
  planned_completion_date: string;
  committed_delivery_date: string;
  revenue_value: number;
  priority: RiskLevel;
  customer?: Customer | null;
  materials_required: ProductionOrderMaterial[];
  risk_level: RiskLevel;
  late_days: number;
  sla_penalty: number;
  projected_completion_date: string | null;
  blocking_disruption_id: number | null;
  blocking_po_number: string | null;
  blocking_material: string | null;
}

export interface ShipmentDelay {
  id: number;
  po_number: string;
  supplier_id: number;
  material_id: number;
  quantity_delayed: number;
  original_eta: string;
  revised_eta: string;
  delay_days: number;
  reason: string | null;
  status: DisruptionStatus;
  impact_severity: Severity;
  reported_at: string;
  supplier?: Supplier | null;
  material?: Material | null;
}

export interface SupplierDetail extends Supplier {
  active_shipment_count: number;
  total_shipment_count: number;
  materials_supplied: number;
  shipments: ShipmentDelay[];
  materials: Material[];
}

export interface CustomerDetail extends Customer {
  active_order_count: number;
  orders_at_risk: number;
  open_revenue: number;
  penalty_exposure: number;
  next_commitment_date: string | null;
  orders: ProductionOrder[];
}

export interface DisruptionSummary {
  id: number;
  po_number: string;
  supplier_name: string;
  material_sku: string;
  material_name: string;
  quantity_delayed: number;
  original_eta: string;
  revised_eta: string;
  delay_days: number;
  status: DisruptionStatus;
  impact_severity: Severity;
  reason: string | null;
  reported_at: string;
  affected_orders_count: number;
  late_orders_count: number;
  shortage_units: number;
  sla_penalty_exposure: number;
  revenue_at_risk: number;
  customers_at_risk: number;
  recommended_strategy: string | null;
  recommended_cost: number | null;
  recommended_penalties_avoided: number | null;
  adopted_strategy: string | null;
}

export interface OrderOutcome {
  order_id: number;
  order_number: string;
  product_name: string;
  customer_id: number | null;
  customer_name: string;
  customer_tier: string;
  priority: RiskLevel;
  status: OrderStatus;
  quantity_required: number;
  quantity_allocated: number;
  unfilled_before: number;
  unfilled_after_pool: number;
  cover_date: string | null;
  planned_completion_date: string;
  committed_delivery_date: string;
  projected_completion_date: string;
  late_days: number;
  sla_penalty: number;
  revenue_value: number;
  is_late: boolean;
  role: 'affected' | 'donor' | 'unaffected';
}

export interface StrategyOutcome {
  key: StrategyKey;
  name: string;
  description: string;
  added_cost: number;
  remaining_delay_days: number;
  days_saved: number;
  supply_arrival_date: string | null;
  shortage_units_immediate: number;
  shortage_units_remaining: number;
  affected_orders_count: number;
  late_orders_count: number;
  protected_commitments: number;
  customers_at_risk: number;
  baseline_sla_penalties: number;
  remaining_sla_penalties: number;
  penalties_avoided: number;
  revenue_at_risk: number;
  revenue_protected: number;
  total_exposure: number;
  net_benefit: number;
  units_reallocated: number;
  units_from_alternate: number;
  recommended: boolean;
  explanation: string;
  risks: string[];
  orders: OrderOutcome[];
}

export interface ScenarioAssumptions {
  delay_days: number;
  expedite_days_saved: number;
  expedite_fixed_cost: number;
  expedite_cost_per_unit: number;
  alternate_lead_time_days: number;
  alternate_price_premium_pct: number;
  alternate_coverage_pct: number;
  reallocation_handling_cost_per_unit: number;
}

export type ScenarioAssumptionOverrides = Partial<Omit<ScenarioAssumptions, 'delay_days'>>;

export interface ScenarioResponse {
  delay_id: number;
  po_number: string;
  material_id: number;
  material_sku: string;
  material_name: string;
  supplier_name: string;
  original_eta: string;
  revised_eta: string;
  reported_delay_days: number;
  simulated_delay_days: number;
  free_stock: number;
  total_unfilled_demand: number;
  assumptions: ScenarioAssumptions;
  strategies: StrategyOutcome[];
  recommended_key: StrategyKey;
  summary: string;
}

export interface StrategyInfo {
  key: StrategyKey;
  name: string;
  short: string;
  description: string;
}

export interface RecoveryDecision {
  id: number;
  shipment_delay_id: number;
  po_number: string;
  material_name: string;
  strategy_key: StrategyKey;
  strategy_name: string;
  simulated_delay_days: number;
  assumptions: Partial<ScenarioAssumptions>;
  added_cost: number;
  remaining_delay_days: number;
  late_orders_count: number;
  protected_commitments: number;
  remaining_sla_penalties: number;
  penalties_avoided: number;
  net_benefit: number;
  revenue_protected: number;
  summary: string | null;
  note: string | null;
  status: 'adopted' | 'superseded';
  decided_at: string;
  decided_by_name: string | null;
}

export interface DisruptionCreate {
  po_number: string;
  supplier_id: number;
  material_id: number;
  quantity_delayed: number;
  original_eta: string;
  revised_eta: string;
  reason?: string;
}

export interface SupplierCreate {
  name: string;
  code: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  lead_time_days: number;
  on_time_delivery_rate: number;
  reliability_score: number;
}

export interface CustomerCreate {
  name: string;
  code: string;
  tier: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  sla_penalty_per_day: number;
  priority_score: number;
}

export interface DisruptionDetail {
  disruption: ShipmentDelay;
  summary: DisruptionSummary;
  inventory: Inventory | null;
  baseline: StrategyOutcome;
  affected_orders: OrderOutcome[];
  recommended: StrategyOutcome;
  scenario_summary: string;
  decisions: RecoveryDecision[];
}

export interface DashboardMetrics {
  orders_at_risk: number;
  orders_total: number;
  critical_shortages: number;
  low_stock_items: number;
  delayed_shipments: number;
  critical_shipments: number;
  commitments_at_risk: number;
  customers_total: number;
  sla_penalty_exposure: number;
  revenue_at_risk: number;
  recoverable_penalties: number;
}

export interface CriticalOrderSummary {
  id: number;
  order_number: string;
  customer_name: string;
  customer_tier: string;
  product_name: string;
  quantity: number;
  status: OrderStatus;
  priority: RiskLevel;
  committed_delivery_date: string;
  projected_completion_date: string;
  late_days: number;
  sla_penalty: number;
  revenue_value: number;
  risk_level: RiskLevel;
  blocking_disruption_id: number | null;
  blocking_po_number: string | null;
  blocking_material: string | null;
}

export interface TimelineEvent {
  date: string;
  kind: 'original_eta' | 'revised_eta' | 'order_due' | 'projected_completion' | 'today';
  label: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  disruption_id: number | null;
  order_id: number | null;
}

export interface NextAction {
  priority: number;
  title: string;
  detail: string;
  route: string;
  severity: string;
}

export interface DashboardSummary {
  generated_at: string;
  demo_data: boolean;
  metrics: DashboardMetrics;
  disruptions: DisruptionSummary[];
  critical_orders: CriticalOrderSummary[];
  timeline: TimelineEvent[];
  next_actions: NextAction[];
  recent_decisions: RecoveryDecision[];
}

export interface SystemInfo {
  app_name: string;
  version: string;
  api_prefix: string;
  database_dialect: string;
  database_target: string;
  using_sqlite_fallback: boolean;
  demo_data: boolean;
  auth: string;
  token_lifetime_minutes: number;
}
