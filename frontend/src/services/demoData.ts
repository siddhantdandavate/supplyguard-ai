/**
 * In-memory / localStorage demonstration data store for SupplyGuard AI Demo Mode.
 * Preserves the exact seeded records, materials, customers, suppliers, inventory,
 * production orders, shipment delays, and past recovery decisions.
 */

import {
  CriticalOrderSummary,
  Customer,
  CustomerDetail,
  DashboardMetrics,
  DashboardSummary,
  DisruptionDetail,
  DisruptionStatus,
  DisruptionSummary,
  Inventory,
  Material,
  NextAction,
  ProductionOrder,
  RecoveryDecision,
  ShipmentDelay,
  ShipmentUpdateHistory,
  StrategyInfo,
  Supplier,
  SupplierDetail,
  TimelineEvent,
  User,
} from '../types/api';
import { simulateInDemo, STRATEGY_META } from './demoEngine';

export interface DemoState {
  users: User[];
  suppliers: Supplier[];
  materials: Material[];
  inventory: Inventory[];
  customers: Customer[];
  orders: ProductionOrder[];
  delays: ShipmentDelay[];
  decisions: RecoveryDecision[];
}

const STORAGE_KEY = 'supplyguard_demo_state_v1';
const DEMO_ACTIVE_USER_KEY = 'supplyguard_demo_active_user';

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initialDemoState(): DemoState {
  const users: User[] = [
    {
      id: 1,
      email: 'planner@supplyguard.io',
      full_name: 'Sarah Jenkins',
      role: 'planner',
      is_active: true,
      created_at: dateOffset(-30),
    },
    {
      id: 2,
      email: 'admin@supplyguard.io',
      full_name: 'Marcus Vance',
      role: 'admin',
      is_active: true,
      created_at: dateOffset(-30),
    },
    {
      id: 3,
      email: 'supplier@apexsensors.example',
      full_name: 'Wei Zhang (Apex Sensors)',
      role: 'supplier',
      supplier_id: 1,
      is_active: true,
      created_at: dateOffset(-30),
    },
  ];

  const suppliers: Supplier[] = [
    {
      id: 1,
      name: 'Apex Precision Sensors',
      code: 'SUP-APX-01',
      contact_name: 'Wei Zhang',
      email: 'logistics@apexsensors.example',
      phone: '+1 (503) 555-0177',
      location: 'Portland, OR',
      lead_time_days: 18,
      on_time_delivery_rate: 0.81,
      reliability_score: 7.8,
      created_at: dateOffset(-120),
    },
    {
      id: 2,
      name: 'Helios Sensorik GmbH',
      code: 'SUP-HEL-02',
      contact_name: 'Anke Brandt',
      email: 'sales@helios-sensorik.example',
      phone: '+49 89 5550 1120',
      location: 'Munich, DE',
      lead_time_days: 9,
      on_time_delivery_rate: 0.93,
      reliability_score: 8.9,
      created_at: dateOffset(-120),
    },
    {
      id: 3,
      name: 'Vanguard CNC Machining',
      code: 'SUP-VAN-03',
      contact_name: 'Elena Rostova',
      email: 'sales@vanguardcnc.example',
      phone: '+1 (312) 555-0144',
      location: 'Chicago, IL',
      lead_time_days: 14,
      on_time_delivery_rate: 0.94,
      reliability_score: 9.1,
      created_at: dateOffset(-120),
    },
    {
      id: 4,
      name: 'Pacific Microelectronics',
      code: 'SUP-PAC-04',
      contact_name: 'Kenji Sato',
      email: 'orders@pacificmicro.example',
      phone: '+1 (415) 555-0192',
      location: 'San Jose, CA',
      lead_time_days: 21,
      on_time_delivery_rate: 0.88,
      reliability_score: 8.2,
      created_at: dateOffset(-120),
    },
    {
      id: 5,
      name: 'Titan Industrial Fasteners',
      code: 'SUP-TIT-05',
      contact_name: 'David Miller',
      email: 'support@titanfasteners.example',
      phone: '+1 (216) 555-0188',
      location: 'Cleveland, OH',
      lead_time_days: 7,
      on_time_delivery_rate: 0.98,
      reliability_score: 9.6,
      created_at: dateOffset(-120),
    },
    {
      id: 6,
      name: 'Norden Motion Drives',
      code: 'SUP-NOR-06',
      contact_name: 'Ida Lund',
      email: 'export@nordenmotion.example',
      phone: '+46 8 5550 2240',
      location: 'Gothenburg, SE',
      lead_time_days: 16,
      on_time_delivery_rate: 0.9,
      reliability_score: 8.6,
      created_at: dateOffset(-120),
    },
  ];

  const materials: Material[] = [
    {
      id: 1,
      sku: 'MAT-OPT-SENS',
      name: 'Optical Rotary Encoder 1024 PPR',
      description: 'Differential line driver incremental optical encoder',
      category: 'Electronics',
      unit_of_measure: 'PCS',
      unit_cost: 36.0,
      supplier_id: 1,
      alternate_supplier_id: 2,
      standard_lead_time_days: 18,
      safety_stock: 50,
      created_at: dateOffset(-100),
      supplier: suppliers[0],
      alternate_supplier: suppliers[1],
    },
    {
      id: 2,
      sku: 'MAT-STP-NEMA23',
      name: 'NEMA 23 High-Torque Stepper Motor',
      description: '1.8 deg dual shaft bipolar stepper motor, 2.8A',
      category: 'Motors & Actuators',
      unit_of_measure: 'PCS',
      unit_cost: 42.0,
      supplier_id: 6,
      alternate_supplier_id: 3,
      standard_lead_time_days: 16,
      safety_stock: 40,
      created_at: dateOffset(-100),
      supplier: suppliers[5],
      alternate_supplier: suppliers[2],
    },
    {
      id: 3,
      sku: 'MAT-ALUM-6061',
      name: 'CNC Milled 6061-T6 Aluminum Arm Joint',
      description: 'Precision milled dual-axis joint bracket',
      category: 'Machined Parts',
      unit_of_measure: 'PCS',
      unit_cost: 28.5,
      supplier_id: 3,
      alternate_supplier_id: null,
      standard_lead_time_days: 14,
      safety_stock: 60,
      created_at: dateOffset(-100),
      supplier: suppliers[2],
    },
    {
      id: 4,
      sku: 'MAT-STM32-MCU',
      name: 'STM32F4 Cortex-M4 Microcontroller',
      description: '32-bit MCU with DSP and FPU, LQFP-100',
      category: 'Electronics',
      unit_of_measure: 'PCS',
      unit_cost: 14.5,
      supplier_id: 4,
      alternate_supplier_id: null,
      standard_lead_time_days: 21,
      safety_stock: 80,
      created_at: dateOffset(-100),
      supplier: suppliers[3],
    },
    {
      id: 5,
      sku: 'MAT-M5-FAST',
      name: 'Grade 10.9 M5 Stainless Fastener Kit',
      description: 'Socket head cap screws and lock nuts',
      category: 'Hardware',
      unit_of_measure: 'SETS',
      unit_cost: 4.2,
      supplier_id: 5,
      alternate_supplier_id: null,
      standard_lead_time_days: 7,
      safety_stock: 300,
      created_at: dateOffset(-100),
      supplier: suppliers[4],
    },
    {
      id: 6,
      sku: 'MAT-DRV-48V',
      name: '48V Servo Drive Module',
      description: 'Closed-loop servo drive, EtherCAT',
      category: 'Electronics',
      unit_of_measure: 'PCS',
      unit_cost: 118.0,
      supplier_id: 4,
      alternate_supplier_id: 6,
      standard_lead_time_days: 21,
      safety_stock: 25,
      created_at: dateOffset(-100),
      supplier: suppliers[3],
      alternate_supplier: suppliers[5],
    },
    {
      id: 7,
      sku: 'MAT-HRN-CBL',
      name: 'Shielded Cable Harness Assembly',
      description: 'Pre-terminated motor/encoder harness, 2 m',
      category: 'Electrical',
      unit_of_measure: 'PCS',
      unit_cost: 22.75,
      supplier_id: 5,
      alternate_supplier_id: null,
      standard_lead_time_days: 10,
      safety_stock: 100,
      created_at: dateOffset(-100),
      supplier: suppliers[4],
    },
  ];

  const inventory: Inventory[] = [
    {
      id: 1,
      material_id: 1,
      current_stock: 30,
      reserved_stock: 30,
      available_stock: 0,
      reorder_point: 50,
      location: 'Cleanroom Shelf 2',
      updated_at: dateOffset(-1),
      material: materials[0],
      stock_status: 'critical',
    },
    {
      id: 2,
      material_id: 2,
      current_stock: 64,
      reserved_stock: 60,
      available_stock: 4,
      reorder_point: 40,
      location: 'Aisle 3-B',
      updated_at: dateOffset(-1),
      material: materials[1],
      stock_status: 'low',
    },
    {
      id: 3,
      material_id: 3,
      current_stock: 190,
      reserved_stock: 140,
      available_stock: 50,
      reorder_point: 60,
      location: 'Pallet R-04',
      updated_at: dateOffset(-1),
      material: materials[2],
      stock_status: 'low',
    },
    {
      id: 4,
      material_id: 4,
      current_stock: 210,
      reserved_stock: 120,
      available_stock: 90,
      reorder_point: 80,
      location: 'Bin E-102',
      updated_at: dateOffset(-1),
      material: materials[3],
      stock_status: 'healthy',
    },
    {
      id: 5,
      material_id: 5,
      current_stock: 850,
      reserved_stock: 350,
      available_stock: 500,
      reorder_point: 300,
      location: 'Hardware Bay 1',
      updated_at: dateOffset(-1),
      material: materials[4],
      stock_status: 'healthy',
    },
    {
      id: 6,
      material_id: 6,
      current_stock: 40,
      reserved_stock: 24,
      available_stock: 16,
      reorder_point: 25,
      location: 'ESD Cage 1',
      updated_at: dateOffset(-1),
      material: materials[5],
      stock_status: 'low',
    },
    {
      id: 7,
      material_id: 7,
      current_stock: 260,
      reserved_stock: 90,
      available_stock: 170,
      reorder_point: 100,
      location: 'Aisle 2-A',
      updated_at: dateOffset(-1),
      material: materials[6],
      stock_status: 'healthy',
    },
  ];

  const customers: Customer[] = [
    {
      id: 1,
      name: 'MedTech Diagnostics Inc',
      code: 'CUST-MED-01',
      tier: 'Tier 1 - Strategic',
      contact_name: 'Dr. Amanda Cross',
      email: 'purchasing@medtechdiag.example',
      phone: '+1 (617) 555-0182',
      sla_penalty_per_day: 1200.0,
      priority_score: 95,
      created_at: dateOffset(-150),
    },
    {
      id: 2,
      name: 'VoltGrid Energy Storage',
      code: 'CUST-VLT-02',
      tier: 'Tier 1 - Strategic',
      contact_name: 'James Robertson',
      email: 'sc-ops@voltgrid.example',
      phone: '+1 (512) 555-0199',
      sla_penalty_per_day: 1500.0,
      priority_score: 98,
      created_at: dateOffset(-150),
    },
    {
      id: 3,
      name: 'OmniLogistics Robotics',
      code: 'CUST-OMN-03',
      tier: 'Tier 2 - Preferred',
      contact_name: 'Raj Patel',
      email: 'supply@omnilogistics.example',
      phone: '+1 (404) 555-0155',
      sla_penalty_per_day: 600.0,
      priority_score: 78,
      created_at: dateOffset(-150),
    },
    {
      id: 4,
      name: 'AgriBot Field Systems',
      code: 'CUST-AGR-04',
      tier: 'Tier 3 - Standard',
      contact_name: 'Lena Fischer',
      email: 'orders@agribot.example',
      phone: '+1 (515) 555-0133',
      sla_penalty_per_day: 250.0,
      priority_score: 55,
      created_at: dateOffset(-150),
    },
  ];

  const orders: ProductionOrder[] = [
    {
      id: 1,
      order_number: 'WO-8420',
      customer_id: 1,
      product_name: 'Precision Surgical Assist Robotic Arm',
      quantity: 20,
      status: 'delayed',
      planned_start_date: dateOffset(-5),
      planned_completion_date: dateOffset(6),
      committed_delivery_date: dateOffset(8),
      revenue_value: 185000.0,
      priority: 'critical',
      risk_level: 'critical',
      late_days: 12,
      sla_penalty: 14400.0,
      projected_completion_date: dateOffset(20),
      blocking_disruption_id: 1,
      blocking_po_number: 'PO-9914',
      blocking_material: 'Optical Rotary Encoder 1024 PPR',
      customer: customers[0],
      materials_required: [
        { id: 1, material_id: 1, quantity_required: 20, quantity_allocated: 0, material: materials[0] },
        { id: 2, material_id: 3, quantity_required: 40, quantity_allocated: 40, material: materials[2] },
        { id: 3, material_id: 4, quantity_required: 20, quantity_allocated: 20, material: materials[3] },
        { id: 4, material_id: 7, quantity_required: 20, quantity_allocated: 20, material: materials[6] },
        { id: 5, material_id: 5, quantity_required: 80, quantity_allocated: 80, material: materials[4] },
      ],
    },
    {
      id: 2,
      order_number: 'WO-8421',
      customer_id: 2,
      product_name: 'Battery Module Cell Sorter Gantry',
      quantity: 15,
      status: 'in_progress',
      planned_start_date: dateOffset(-2),
      planned_completion_date: dateOffset(10),
      committed_delivery_date: dateOffset(12),
      revenue_value: 245000.0,
      priority: 'critical',
      risk_level: 'critical',
      late_days: 12,
      sla_penalty: 18000.0,
      projected_completion_date: dateOffset(24),
      blocking_disruption_id: 1,
      blocking_po_number: 'PO-9914',
      blocking_material: 'Optical Rotary Encoder 1024 PPR',
      customer: customers[1],
      materials_required: [
        { id: 6, material_id: 1, quantity_required: 30, quantity_allocated: 20, material: materials[0] },
        { id: 7, material_id: 2, quantity_required: 30, quantity_allocated: 30, material: materials[1] },
        { id: 8, material_id: 4, quantity_required: 15, quantity_allocated: 15, material: materials[3] },
        { id: 9, material_id: 6, quantity_required: 15, quantity_allocated: 15, material: materials[5] },
        { id: 10, material_id: 7, quantity_required: 30, quantity_allocated: 30, material: materials[6] },
        { id: 11, material_id: 5, quantity_required: 90, quantity_allocated: 90, material: materials[4] },
      ],
    },
    {
      id: 3,
      order_number: 'WO-8422',
      customer_id: 3,
      product_name: 'OmniSort Package Handling Arm',
      quantity: 30,
      status: 'scheduled',
      planned_start_date: dateOffset(4),
      planned_completion_date: dateOffset(18),
      committed_delivery_date: dateOffset(20),
      revenue_value: 120000.0,
      priority: 'high',
      risk_level: 'high',
      late_days: 10,
      sla_penalty: 6000.0,
      projected_completion_date: dateOffset(30),
      blocking_disruption_id: 1,
      blocking_po_number: 'PO-9914',
      blocking_material: 'Optical Rotary Encoder 1024 PPR',
      customer: customers[2],
      materials_required: [
        { id: 12, material_id: 1, quantity_required: 30, quantity_allocated: 0, material: materials[0] },
        { id: 13, material_id: 2, quantity_required: 60, quantity_allocated: 30, material: materials[1] },
        { id: 14, material_id: 3, quantity_required: 60, quantity_allocated: 60, material: materials[2] },
        { id: 15, material_id: 7, quantity_required: 30, quantity_allocated: 30, material: materials[6] },
        { id: 16, material_id: 5, quantity_required: 120, quantity_allocated: 120, material: materials[4] },
      ],
    },
    {
      id: 4,
      order_number: 'WO-8423',
      customer_id: 2,
      product_name: 'Pack Inspection Linear Stage',
      quantity: 10,
      status: 'in_progress',
      planned_start_date: dateOffset(-6),
      planned_completion_date: dateOffset(5),
      committed_delivery_date: dateOffset(9),
      revenue_value: 98000.0,
      priority: 'high',
      risk_level: 'low',
      late_days: 0,
      sla_penalty: 0.0,
      projected_completion_date: dateOffset(5),
      blocking_disruption_id: null,
      blocking_po_number: null,
      blocking_material: null,
      customer: customers[1],
      materials_required: [
        { id: 17, material_id: 4, quantity_required: 10, quantity_allocated: 10, material: materials[3] },
        { id: 18, material_id: 6, quantity_required: 9, quantity_allocated: 9, material: materials[5] },
        { id: 19, material_id: 7, quantity_required: 10, quantity_allocated: 10, material: materials[6] },
        { id: 20, material_id: 5, quantity_required: 60, quantity_allocated: 60, material: materials[4] },
      ],
    },
    {
      id: 5,
      order_number: 'WO-8424',
      customer_id: 4,
      product_name: 'AgriBot Seed Drill Controller',
      quantity: 40,
      status: 'scheduled',
      planned_start_date: dateOffset(9),
      planned_completion_date: dateOffset(21),
      committed_delivery_date: dateOffset(26),
      revenue_value: 64000.0,
      priority: 'medium',
      risk_level: 'medium',
      late_days: 0,
      sla_penalty: 0.0,
      projected_completion_date: dateOffset(21),
      blocking_disruption_id: 2,
      blocking_po_number: 'PO-9921',
      blocking_material: 'NEMA 23 High-Torque Stepper Motor',
      customer: customers[3],
      materials_required: [
        { id: 21, material_id: 2, quantity_required: 40, quantity_allocated: 0, material: materials[1] },
        { id: 22, material_id: 4, quantity_required: 40, quantity_allocated: 40, material: materials[3] },
      ],
    },
    {
      id: 6,
      order_number: 'WO-8425',
      customer_id: 3,
      product_name: 'Conveyor Vision Gantry (Pilot)',
      quantity: 8,
      status: 'scheduled',
      planned_start_date: dateOffset(22),
      planned_completion_date: dateOffset(34),
      committed_delivery_date: dateOffset(40),
      revenue_value: 52000.0,
      priority: 'low',
      risk_level: 'low',
      late_days: 0,
      sla_penalty: 0.0,
      projected_completion_date: dateOffset(34),
      blocking_disruption_id: null,
      blocking_po_number: null,
      blocking_material: null,
      customer: customers[2],
      materials_required: [
        { id: 23, material_id: 1, quantity_required: 10, quantity_allocated: 10, material: materials[0] },
        { id: 24, material_id: 3, quantity_required: 16, quantity_allocated: 16, material: materials[2] },
      ],
    },
    {
      id: 7,
      order_number: 'WO-8426',
      customer_id: 1,
      product_name: 'Sterile Tray Handling Module',
      quantity: 12,
      status: 'scheduled',
      planned_start_date: dateOffset(14),
      planned_completion_date: dateOffset(27),
      committed_delivery_date: dateOffset(30),
      revenue_value: 76000.0,
      priority: 'medium',
      risk_level: 'low',
      late_days: 0,
      sla_penalty: 0.0,
      projected_completion_date: dateOffset(27),
      blocking_disruption_id: null,
      blocking_po_number: null,
      blocking_material: null,
      customer: customers[0],
      materials_required: [
        { id: 25, material_id: 2, quantity_required: 12, quantity_allocated: 0, material: materials[1] },
        { id: 26, material_id: 3, quantity_required: 24, quantity_allocated: 24, material: materials[2] },
        { id: 27, material_id: 4, quantity_required: 12, quantity_allocated: 12, material: materials[3] },
      ],
    },
    {
      id: 8,
      order_number: 'WO-8419',
      customer_id: 4,
      product_name: 'Irrigation Valve Actuator Batch',
      quantity: 60,
      status: 'completed',
      planned_start_date: dateOffset(-30),
      planned_completion_date: dateOffset(-12),
      committed_delivery_date: dateOffset(-10),
      revenue_value: 41000.0,
      priority: 'low',
      risk_level: 'low',
      late_days: 0,
      sla_penalty: 0.0,
      projected_completion_date: dateOffset(-12),
      blocking_disruption_id: null,
      blocking_po_number: null,
      blocking_material: null,
      customer: customers[3],
      materials_required: [],
    },
  ];

  const updateHist1: ShipmentUpdateHistory[] = [
    {
      id: 1,
      shipment_delay_id: 1,
      updated_by_user_id: 3,
      updated_by_name: 'Wei Zhang (Apex Sensors)',
      previous_status: 'delayed',
      new_status: 'customs_hold',
      previous_revised_eta: dateOffset(8),
      new_revised_eta: dateOffset(12),
      previous_quantity_delayed: 100,
      new_quantity_delayed: 100,
      delay_reason: 'Export customs inspection hold at origin air terminal',
      note: 'Export broker advised 4-day customs hold at origin port.',
      updated_at: new Date().toISOString(),
    },
  ];

  const delays: ShipmentDelay[] = [
    {
      id: 1,
      po_number: 'PO-9914',
      supplier_id: 1,
      material_id: 1,
      quantity_delayed: 100,
      original_eta: dateOffset(-2),
      revised_eta: dateOffset(12),
      delay_days: 14,
      reason: 'Export customs inspection hold at origin air terminal',
      status: 'active',
      impact_severity: 'critical',
      reported_at: dateOffset(-2),
      updated_at: dateOffset(0),
      last_updated_by_role: 'supplier',
      supplier: suppliers[0],
      material: materials[0],
      update_history: updateHist1,
    },
    {
      id: 2,
      po_number: 'PO-9921',
      supplier_id: 6,
      material_id: 2,
      quantity_delayed: 80,
      original_eta: dateOffset(1),
      revised_eta: dateOffset(7),
      delay_days: 6,
      reason: 'Ocean carrier blank sailing; rebooked to next vessel',
      status: 'active',
      impact_severity: 'high',
      reported_at: dateOffset(-1),
      supplier: suppliers[5],
      material: materials[1],
      update_history: [],
    },
    {
      id: 3,
      po_number: 'PO-9930',
      supplier_id: 3,
      material_id: 3,
      quantity_delayed: 60,
      original_eta: dateOffset(3),
      revised_eta: dateOffset(6),
      delay_days: 3,
      reason: 'CNC spindle maintenance pushed the finishing run',
      status: 'mitigated',
      impact_severity: 'medium',
      reported_at: dateOffset(-3),
      supplier: suppliers[2],
      material: materials[2],
      update_history: [],
    },
    {
      id: 4,
      po_number: 'PO-9888',
      supplier_id: 4,
      material_id: 4,
      quantity_delayed: 200,
      original_eta: dateOffset(-20),
      revised_eta: dateOffset(-15),
      delay_days: 5,
      reason: 'Component allocation shortfall at distributor',
      status: 'resolved',
      impact_severity: 'medium',
      reported_at: dateOffset(-20),
      supplier: suppliers[3],
      material: materials[3],
      update_history: [],
    },
  ];

  const decisions: RecoveryDecision[] = [
    {
      id: 1,
      shipment_delay_id: 3,
      po_number: 'PO-9930',
      material_name: 'CNC Milled 6061-T6 Aluminum Arm Joint',
      strategy_key: 'reallocation',
      strategy_name: 'Inventory reallocation',
      simulated_delay_days: 3,
      assumptions: {},
      added_cost: 80.0,
      remaining_delay_days: 3,
      late_orders_count: 0,
      protected_commitments: 1,
      remaining_sla_penalties: 0.0,
      penalties_avoided: 3600.0,
      net_benefit: 3520.0,
      revenue_protected: 120000.0,
      summary: 'Reallocated 40 units from buffer; zero customer orders late.',
      note: 'Vanguard confirmed finishing run restarts Monday; no customer impact.',
      status: 'adopted',
      decided_at: dateOffset(-1) + 'T14:30:00Z',
      decided_by_name: 'Sarah Jenkins',
    },
  ];

  return { users, suppliers, materials, inventory, customers, orders, delays, decisions };
}

export function getDemoState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback to initial
  }
  const init = initialDemoState();
  saveDemoState(init);
  return init;
}

export function saveDemoState(state: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage not available
  }
}

export function getDemoActiveUser(): User | null {
  try {
    const raw = localStorage.getItem(DEMO_ACTIVE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return null;
}

export function setDemoActiveUser(user: User | null) {
  try {
    if (user) localStorage.setItem(DEMO_ACTIVE_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(DEMO_ACTIVE_USER_KEY);
  } catch {
    // storage error
  }
}

// -----------------------------------------------------------------------------
// Demo Service API Implementations
// -----------------------------------------------------------------------------

export function demoLogin(email: string): User {
  const state = getDemoState();
  const normalized = email.trim().toLowerCase();
  let user = state.users.find((u) => u.email.toLowerCase() === normalized);

  if (!user) {
    // If entered unknown email in demo mode, default to planner role
    user = {
      id: 99,
      email: normalized,
      full_name: email.split('@')[0],
      role: 'planner',
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  setDemoActiveUser(user);
  return user;
}

export function demoGetDisruptions(): DisruptionSummary[] {
  const state = getDemoState();
  return state.delays.map((d) => {
    const mat = state.materials.find((m) => m.id === d.material_id);
    const sup = state.suppliers.find((s) => s.id === d.supplier_id);
    const sim = simulateInDemo(state, d.id, d.delay_days);
    const base = sim.strategies.find((s) => s.key === 'baseline')!;
    const rec = sim.strategies.find((s) => s.recommended)!;
    const adopted = state.decisions.find((dec) => dec.shipment_delay_id === d.id && dec.status === 'adopted');

    return {
      id: d.id,
      po_number: d.po_number,
      supplier_name: sup?.name ?? 'Supplier',
      material_sku: mat?.sku ?? '',
      material_name: mat?.name ?? '',
      quantity_delayed: d.quantity_delayed,
      original_eta: d.original_eta,
      revised_eta: d.revised_eta,
      delay_days: d.delay_days,
      status: d.status,
      impact_severity: d.impact_severity,
      reason: d.reason,
      reported_at: d.reported_at,
      updated_at: d.updated_at,
      last_updated_by_role: d.last_updated_by_role,
      last_update_reason: d.update_history?.[0]?.delay_reason ?? d.reason,
      affected_orders_count: base.affected_orders_count,
      late_orders_count: base.late_orders_count,
      shortage_units: base.shortage_units_immediate,
      sla_penalty_exposure: base.remaining_sla_penalties,
      revenue_at_risk: base.revenue_at_risk,
      customers_at_risk: base.customers_at_risk,
      recommended_strategy: rec.name,
      recommended_cost: rec.added_cost,
      recommended_penalties_avoided: rec.penalties_avoided,
      adopted_strategy: adopted?.strategy_name ?? null,
    };
  });
}

export function demoGetDashboard(): DashboardSummary {
  const state = getDemoState();
  const disruptions = demoGetDisruptions();
  const activeDisruptions = disruptions.filter((d) => d.status === 'active');

  const ordersAtRisk = state.orders.filter((o) => o.status === 'delayed' || o.late_days > 0).length;
  const criticalShortages = state.inventory.filter((i) => i.available_stock <= 0).length;
  const lowStock = state.inventory.filter((i) => i.available_stock > 0 && i.available_stock <= i.reorder_point).length;
  const totalSla = activeDisruptions.reduce((sum, d) => sum + d.sla_penalty_exposure, 0);
  const totalRevAtRisk = state.orders.filter((o) => o.late_days > 0).reduce((sum, o) => sum + o.revenue_value, 0);
  const recoverable = activeDisruptions.reduce((sum, d) => sum + (d.recommended_penalties_avoided ?? 0), 0);

  const metrics: DashboardMetrics = {
    orders_at_risk: ordersAtRisk,
    orders_total: state.orders.length,
    critical_shortages: criticalShortages,
    low_stock_items: lowStock,
    delayed_shipments: activeDisruptions.length,
    critical_shipments: activeDisruptions.filter((d) => d.impact_severity === 'critical').length,
    commitments_at_risk: 3,
    customers_total: state.customers.length,
    sla_penalty_exposure: totalSla,
    revenue_at_risk: totalRevAtRisk,
    recoverable_penalties: recoverable,
  };

  const criticalOrders: CriticalOrderSummary[] = state.orders
    .filter((o) => o.status !== 'completed' && o.priority !== 'low')
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.customer?.name ?? '',
      customer_tier: o.customer?.tier ?? '',
      product_name: o.product_name,
      quantity: o.quantity,
      status: o.status,
      priority: o.priority,
      committed_delivery_date: o.committed_delivery_date,
      projected_completion_date: o.projected_completion_date ?? o.planned_completion_date,
      late_days: o.late_days,
      sla_penalty: o.sla_penalty,
      revenue_value: o.revenue_value,
      risk_level: o.risk_level,
      blocking_disruption_id: o.blocking_disruption_id,
      blocking_po_number: o.blocking_po_number,
      blocking_material: o.blocking_material,
    }));

  const timeline: TimelineEvent[] = [
    {
      date: dateOffset(0),
      kind: 'today',
      label: 'Today',
      severity: 'info',
      disruption_id: null,
      order_id: null,
    },
    {
      date: dateOffset(6),
      kind: 'order_due',
      label: 'WO-8420 completion target',
      severity: 'high',
      disruption_id: 1,
      order_id: 1,
    },
    {
      date: dateOffset(12),
      kind: 'revised_eta',
      label: 'PO-9914 revised ETA (+14d slip)',
      severity: 'critical',
      disruption_id: 1,
      order_id: null,
    },
  ];

  const nextActions: NextAction[] = [
    {
      priority: 1,
      title: 'Resolve critical PO-9914 delay',
      detail: 'Expedite or reallocate to protect $40,200 in MedTech & VoltGrid commitments.',
      route: '/war-room/1',
      severity: 'critical',
    },
    {
      priority: 2,
      title: 'Review ocean shipment PO-9921',
      detail: 'Norden stepper motor delayed 6 days; assess safety stock coverage.',
      route: '/war-room/2',
      severity: 'high',
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    demo_data: true,
    metrics,
    disruptions,
    critical_orders: criticalOrders,
    timeline,
    next_actions: nextActions,
    recent_decisions: state.decisions.slice(0, 5),
  };
}

export function demoGetDisruptionDetail(id: number): DisruptionDetail {
  const state = getDemoState();
  const delay = state.delays.find((d) => d.id === id);
  if (!delay) throw new Error(`Disruption ${id} not found`);

  const sim = simulateInDemo(state, id, delay.delay_days);
  const baseline = sim.strategies.find((s) => s.key === 'baseline')!;
  const rec = sim.strategies.find((s) => s.recommended)!;
  const inv = state.inventory.find((i) => i.material_id === delay.material_id) ?? null;
  const decisions = state.decisions.filter((d) => d.shipment_delay_id === id);

  const summaries = demoGetDisruptions();
  const summary = summaries.find((s) => s.id === id)!;

  return {
    disruption: delay,
    summary,
    inventory: inv,
    baseline,
    affected_orders: baseline.orders,
    recommended: rec,
    scenario_summary: sim.summary,
    decisions,
  };
}

export function demoAdoptDecision(
  delayId: number,
  payload: {
    strategy_key: string;
    delay_days: number | null;
    assumptions?: any;
    note?: string;
    mark_mitigated?: boolean;
  },
): RecoveryDecision {
  const state = getDemoState();
  const delay = state.delays.find((d) => d.id === delayId);
  if (!delay) throw new Error(`Disruption ${delayId} not found`);

  const sim = simulateInDemo(state, delayId, payload.delay_days ?? delay.delay_days, payload.assumptions);
  const strat = sim.strategies.find((s) => s.key === payload.strategy_key) ?? sim.strategies[0];

  // Mark previous decisions for this disruption as superseded
  for (const d of state.decisions) {
    if (d.shipment_delay_id === delayId && d.status === 'adopted') {
      d.status = 'superseded';
    }
  }

  const newDecision: RecoveryDecision = {
    id: (state.decisions.length > 0 ? Math.max(...state.decisions.map((x) => x.id)) : 0) + 1,
    shipment_delay_id: delayId,
    po_number: delay.po_number,
    material_name: sim.material_name,
    strategy_key: strat.key,
    strategy_name: strat.name,
    simulated_delay_days: sim.simulated_delay_days,
    assumptions: payload.assumptions ?? {},
    added_cost: strat.added_cost,
    remaining_delay_days: strat.remaining_delay_days,
    late_orders_count: strat.late_orders_count,
    protected_commitments: strat.protected_commitments,
    remaining_sla_penalties: strat.remaining_sla_penalties,
    penalties_avoided: strat.penalties_avoided,
    net_benefit: strat.net_benefit,
    revenue_protected: strat.revenue_protected,
    summary: strat.explanation,
    note: payload.note || 'Adopted in demo simulation',
    status: 'adopted',
    decided_at: new Date().toISOString(),
    decided_by_name: getDemoActiveUser()?.full_name ?? 'Planner',
  };

  state.decisions.unshift(newDecision);

  // If mark_mitigated is true and not baseline, transition disruption to mitigated
  if (payload.mark_mitigated !== false && strat.key !== 'baseline') {
    delay.status = 'mitigated';
  }

  saveDemoState(state);
  return newDecision;
}

export function demoGetSupplierShipments(supplierId = 1): ShipmentDelay[] {
  const state = getDemoState();
  return state.delays.filter((d) => d.supplier_id === supplierId);
}

export function demoUpdateSupplierShipment(
  id: number,
  payload: {
    status?: DisruptionStatus;
    revised_eta?: string;
    reason?: string;
    quantity_delayed?: number;
    note?: string;
  },
): ShipmentDelay {
  const state = getDemoState();
  const delay = state.delays.find((d) => d.id === id);
  if (!delay) throw new Error(`Shipment ${id} not found`);

  const prevStatus = delay.status;
  const prevEta = delay.revised_eta;
  const prevQty = delay.quantity_delayed;

  if (payload.status) delay.status = payload.status;
  if (payload.reason) delay.reason = payload.reason;
  if (payload.quantity_delayed) delay.quantity_delayed = payload.quantity_delayed;

  if (payload.revised_eta) {
    delay.revised_eta = payload.revised_eta;
    const [origY, origM, origD] = delay.original_eta.split('-').map(Number);
    const [revY, revM, revD] = payload.revised_eta.split('-').map(Number);
    const msOrig = Date.UTC(origY, origM - 1, origD);
    const msRev = Date.UTC(revY, revM - 1, revD);
    delay.delay_days = Math.max(0, Math.round((msRev - msOrig) / (24 * 3600 * 1000)));
  }

  delay.updated_at = new Date().toISOString();
  delay.last_updated_by_role = 'supplier';

  const historyEntry: ShipmentUpdateHistory = {
    id: (delay.update_history?.length ?? 0) + 1,
    shipment_delay_id: delay.id,
    updated_by_user_id: getDemoActiveUser()?.id ?? 3,
    updated_by_name: getDemoActiveUser()?.full_name ?? 'Wei Zhang (Apex Sensors)',
    previous_status: prevStatus,
    new_status: delay.status,
    previous_revised_eta: prevEta,
    new_revised_eta: delay.revised_eta,
    previous_quantity_delayed: prevQty,
    new_quantity_delayed: delay.quantity_delayed,
    delay_reason: payload.reason ?? delay.reason,
    note: payload.note ?? null,
    updated_at: delay.updated_at,
  };

  delay.update_history = [historyEntry, ...(delay.update_history ?? [])];

  saveDemoState(state);
  return delay;
}

export function demoGetSuppliers(): SupplierDetail[] {
  const state = getDemoState();
  return state.suppliers.map((s) => ({
    ...s,
    active_shipment_count: state.delays.filter((d) => d.supplier_id === s.id && d.status === 'active').length,
    total_shipment_count: state.delays.filter((d) => d.supplier_id === s.id).length,
    materials_supplied: state.materials.filter((m) => m.supplier_id === s.id).length,
    shipments: state.delays.filter((d) => d.supplier_id === s.id),
    materials: state.materials.filter((m) => m.supplier_id === s.id),
  }));
}

export function demoGetCustomers(): CustomerDetail[] {
  const state = getDemoState();
  return state.customers.map((c) => {
    const custOrders = state.orders.filter((o) => o.customer_id === c.id);
    return {
      ...c,
      active_order_count: custOrders.filter((o) => o.status !== 'completed').length,
      orders_at_risk: custOrders.filter((o) => o.late_days > 0).length,
      open_revenue: custOrders.filter((o) => o.status !== 'completed').reduce((sum, o) => sum + o.revenue_value, 0),
      penalty_exposure: custOrders.reduce((sum, o) => sum + o.sla_penalty, 0),
      next_commitment_date: custOrders[0]?.committed_delivery_date ?? null,
      orders: custOrders,
    };
  });
}

export function demoGetStrategies(): StrategyInfo[] {
  return (['baseline', 'expedite', 'alternate', 'reallocation', 'combined'] as const).map((k) => ({
    key: k,
    ...STRATEGY_META[k],
  }));
}
