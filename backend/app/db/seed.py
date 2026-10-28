"""
Demonstration data for SupplyGuard AI.

Everything created here is fictional demo data for a small robotics/automation
manufacturer. Dates are relative to the day the database is seeded so the demo
disruption is always "live". Run `python -m app.db.seed --reset` to rebuild it.
"""
import argparse
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
import app.models  # noqa: F401
from app.models.user import User
from app.models.supplier import Supplier
from app.models.material import Material
from app.models.inventory import Inventory
from app.models.customer import Customer
from app.models.disruption import ProductionOrder, ProductionOrderMaterial, RecoveryDecision, ShipmentDelay

logger = logging.getLogger("supplyguard.seed")

DEMO_USERS = [
    {"email": "planner@supplyguard.io", "password": "password123", "full_name": "Sarah Jenkins", "role": "planner"},
    {"email": "admin@supplyguard.io", "password": "admin123", "full_name": "Marcus Vance", "role": "admin"},
]


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_database(db: Session | None = None, force: bool = False) -> bool:
    """Populate demo data. Returns True if data was written."""
    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True

    try:
        if db.query(User).first() and not force:
            logger.info("Database already seeded; skipping.")
            return False

        logger.info("Seeding demonstration data...")
        today = date.today()
        d = lambda n: today + timedelta(days=n)  # noqa: E731

        # ---------------------------------------------------------------- users
        users = [
            User(email=u["email"], full_name=u["full_name"], hashed_password=get_password_hash(u["password"]), role=u["role"], is_active=True)
            for u in DEMO_USERS
        ]
        db.add_all(users)
        db.flush()

        # ------------------------------------------------------------ suppliers
        sup_apex = Supplier(name="Apex Precision Sensors", code="SUP-APX-01", contact_name="Wei Zhang", email="logistics@apexsensors.example", phone="+1 (503) 555-0177", location="Portland, OR", lead_time_days=18, on_time_delivery_rate=0.81, reliability_score=7.8)
        sup_helios = Supplier(name="Helios Sensorik GmbH", code="SUP-HEL-02", contact_name="Anke Brandt", email="sales@helios-sensorik.example", phone="+49 89 5550 1120", location="Munich, DE", lead_time_days=9, on_time_delivery_rate=0.93, reliability_score=8.9)
        sup_vanguard = Supplier(name="Vanguard CNC Machining", code="SUP-VAN-03", contact_name="Elena Rostova", email="sales@vanguardcnc.example", phone="+1 (312) 555-0144", location="Chicago, IL", lead_time_days=14, on_time_delivery_rate=0.94, reliability_score=9.1)
        sup_pacific = Supplier(name="Pacific Microelectronics", code="SUP-PAC-04", contact_name="Kenji Sato", email="orders@pacificmicro.example", phone="+1 (415) 555-0192", location="San Jose, CA", lead_time_days=21, on_time_delivery_rate=0.88, reliability_score=8.2)
        sup_titan = Supplier(name="Titan Industrial Fasteners", code="SUP-TIT-05", contact_name="David Miller", email="support@titanfasteners.example", phone="+1 (216) 555-0188", location="Cleveland, OH", lead_time_days=7, on_time_delivery_rate=0.98, reliability_score=9.6)
        sup_norden = Supplier(name="Norden Motion Drives", code="SUP-NOR-06", contact_name="Ida Lund", email="export@nordenmotion.example", phone="+46 8 5550 2240", location="Gothenburg, SE", lead_time_days=16, on_time_delivery_rate=0.90, reliability_score=8.6)
        db.add_all([sup_apex, sup_helios, sup_vanguard, sup_pacific, sup_titan, sup_norden])
        db.flush()

        # ------------------------------------------------------------ materials
        m_encoder = Material(sku="MAT-OPT-SENS", name="Optical Rotary Encoder 1024 PPR", description="Differential line driver incremental optical encoder", category="Electronics", unit_of_measure="PCS", unit_cost=36.00, supplier_id=sup_apex.id, alternate_supplier_id=sup_helios.id, standard_lead_time_days=18, safety_stock=50)
        m_stepper = Material(sku="MAT-STP-NEMA23", name="NEMA 23 High-Torque Stepper Motor", description="1.8 deg dual shaft bipolar stepper motor, 2.8A", category="Motors & Actuators", unit_of_measure="PCS", unit_cost=42.00, supplier_id=sup_norden.id, alternate_supplier_id=sup_vanguard.id, standard_lead_time_days=16, safety_stock=40)
        m_arm = Material(sku="MAT-ALUM-6061", name="CNC Milled 6061-T6 Aluminum Arm Joint", description="Precision milled dual-axis joint bracket", category="Machined Parts", unit_of_measure="PCS", unit_cost=28.50, supplier_id=sup_vanguard.id, standard_lead_time_days=14, safety_stock=60)
        m_mcu = Material(sku="MAT-STM32-MCU", name="STM32F4 Cortex-M4 Microcontroller", description="32-bit MCU with DSP and FPU, LQFP-100", category="Electronics", unit_of_measure="PCS", unit_cost=14.50, supplier_id=sup_pacific.id, standard_lead_time_days=21, safety_stock=80)
        m_fastener = Material(sku="MAT-M5-FAST", name="Grade 10.9 M5 Stainless Fastener Kit", description="Socket head cap screws and lock nuts", category="Hardware", unit_of_measure="SETS", unit_cost=4.20, supplier_id=sup_titan.id, standard_lead_time_days=7, safety_stock=300)
        m_driver = Material(sku="MAT-DRV-48V", name="48V Servo Drive Module", description="Closed-loop servo drive, EtherCAT", category="Electronics", unit_of_measure="PCS", unit_cost=118.00, supplier_id=sup_pacific.id, alternate_supplier_id=sup_norden.id, standard_lead_time_days=21, safety_stock=25)
        m_harness = Material(sku="MAT-HRN-CBL", name="Shielded Cable Harness Assembly", description="Pre-terminated motor/encoder harness, 2 m", category="Electrical", unit_of_measure="PCS", unit_cost=22.75, supplier_id=sup_titan.id, standard_lead_time_days=10, safety_stock=100)
        db.add_all([m_encoder, m_stepper, m_arm, m_mcu, m_fastener, m_driver, m_harness])
        db.flush()

        # ------------------------------------------------------------ inventory
        db.add_all([
            Inventory(material_id=m_encoder.id, current_stock=30, reserved_stock=30, reorder_point=50, location="Cleanroom Shelf 2"),
            Inventory(material_id=m_stepper.id, current_stock=64, reserved_stock=60, reorder_point=40, location="Aisle 3-B"),
            Inventory(material_id=m_arm.id, current_stock=190, reserved_stock=140, reorder_point=60, location="Pallet R-04"),
            Inventory(material_id=m_mcu.id, current_stock=210, reserved_stock=120, reorder_point=80, location="Bin E-102"),
            Inventory(material_id=m_fastener.id, current_stock=850, reserved_stock=350, reorder_point=300, location="Hardware Bay 1"),
            Inventory(material_id=m_driver.id, current_stock=40, reserved_stock=24, reorder_point=25, location="ESD Cage 1"),
            Inventory(material_id=m_harness.id, current_stock=260, reserved_stock=90, reorder_point=100, location="Aisle 2-A"),
        ])
        db.flush()

        # ------------------------------------------------------------ customers
        c_medtech = Customer(name="MedTech Diagnostics Inc", code="CUST-MED-01", tier="Tier 1 - Strategic", contact_name="Dr. Amanda Cross", email="purchasing@medtechdiag.example", phone="+1 (617) 555-0182", sla_penalty_per_day=1200.0, priority_score=95)
        c_volt = Customer(name="VoltGrid Energy Storage", code="CUST-VLT-02", tier="Tier 1 - Strategic", contact_name="James Robertson", email="sc-ops@voltgrid.example", phone="+1 (512) 555-0199", sla_penalty_per_day=1500.0, priority_score=98)
        c_omni = Customer(name="OmniLogistics Robotics", code="CUST-OMN-03", tier="Tier 2 - Preferred", contact_name="Raj Patel", email="supply@omnilogistics.example", phone="+1 (404) 555-0155", sla_penalty_per_day=600.0, priority_score=78)
        c_agri = Customer(name="AgriBot Field Systems", code="CUST-AGR-04", tier="Tier 3 - Standard", contact_name="Lena Fischer", email="orders@agribot.example", phone="+1 (515) 555-0133", sla_penalty_per_day=250.0, priority_score=55)
        db.add_all([c_medtech, c_volt, c_omni, c_agri])
        db.flush()

        # ----------------------------------------------------- production orders
        wo_8420 = ProductionOrder(order_number="WO-8420", customer_id=c_medtech.id, product_name="Precision Surgical Assist Robotic Arm", quantity=20, status="delayed", planned_start_date=d(-5), planned_completion_date=d(6), committed_delivery_date=d(8), revenue_value=185000.0, priority="critical")
        wo_8421 = ProductionOrder(order_number="WO-8421", customer_id=c_volt.id, product_name="Battery Module Cell Sorter Gantry", quantity=15, status="in_progress", planned_start_date=d(-2), planned_completion_date=d(10), committed_delivery_date=d(12), revenue_value=245000.0, priority="critical")
        wo_8422 = ProductionOrder(order_number="WO-8422", customer_id=c_omni.id, product_name="OmniSort Package Handling Arm", quantity=30, status="scheduled", planned_start_date=d(4), planned_completion_date=d(18), committed_delivery_date=d(20), revenue_value=120000.0, priority="high")
        wo_8423 = ProductionOrder(order_number="WO-8423", customer_id=c_volt.id, product_name="Pack Inspection Linear Stage", quantity=10, status="in_progress", planned_start_date=d(-6), planned_completion_date=d(5), committed_delivery_date=d(9), revenue_value=98000.0, priority="high")
        wo_8424 = ProductionOrder(order_number="WO-8424", customer_id=c_agri.id, product_name="AgriBot Seed Drill Controller", quantity=40, status="scheduled", planned_start_date=d(9), planned_completion_date=d(21), committed_delivery_date=d(26), revenue_value=64000.0, priority="medium")
        wo_8425 = ProductionOrder(order_number="WO-8425", customer_id=c_omni.id, product_name="Conveyor Vision Gantry (Pilot)", quantity=8, status="scheduled", planned_start_date=d(22), planned_completion_date=d(34), committed_delivery_date=d(40), revenue_value=52000.0, priority="low")
        wo_8426 = ProductionOrder(order_number="WO-8426", customer_id=c_medtech.id, product_name="Sterile Tray Handling Module", quantity=12, status="scheduled", planned_start_date=d(14), planned_completion_date=d(27), committed_delivery_date=d(30), revenue_value=76000.0, priority="medium")
        wo_8419 = ProductionOrder(order_number="WO-8419", customer_id=c_agri.id, product_name="Irrigation Valve Actuator Batch", quantity=60, status="completed", planned_start_date=d(-30), planned_completion_date=d(-12), committed_delivery_date=d(-10), revenue_value=41000.0, priority="low")
        db.add_all([wo_8420, wo_8421, wo_8422, wo_8423, wo_8424, wo_8425, wo_8426, wo_8419])
        db.flush()

        bom = [
            # Encoders (delayed, critical)
            (wo_8420, m_encoder, 20, 0), (wo_8421, m_encoder, 30, 20), (wo_8422, m_encoder, 30, 0), (wo_8425, m_encoder, 10, 10),
            # Steppers (delayed, high)
            (wo_8421, m_stepper, 30, 30), (wo_8422, m_stepper, 60, 30), (wo_8424, m_stepper, 40, 0), (wo_8426, m_stepper, 12, 0),
            # Aluminum arm joints (minor delay, mitigated)
            (wo_8420, m_arm, 40, 40), (wo_8422, m_arm, 60, 60), (wo_8426, m_arm, 24, 24), (wo_8425, m_arm, 16, 16),
            # Other materials (healthy)
            (wo_8420, m_mcu, 20, 20), (wo_8421, m_mcu, 15, 15), (wo_8423, m_mcu, 10, 10), (wo_8424, m_mcu, 40, 40), (wo_8426, m_mcu, 12, 12),
            (wo_8421, m_driver, 15, 15), (wo_8423, m_driver, 9, 9),
            (wo_8420, m_harness, 20, 20), (wo_8421, m_harness, 30, 30), (wo_8423, m_harness, 10, 10), (wo_8422, m_harness, 30, 30),
            (wo_8420, m_fastener, 80, 80), (wo_8421, m_fastener, 90, 90), (wo_8422, m_fastener, 120, 120), (wo_8423, m_fastener, 60, 60),
        ]
        db.add_all([ProductionOrderMaterial(production_order_id=o.id, material_id=m.id, quantity_required=req, quantity_allocated=alloc) for o, m, req, alloc in bom])
        db.flush()

        # ------------------------------------------------------ shipment delays
        db.add_all([
            ShipmentDelay(po_number="PO-9914", supplier_id=sup_apex.id, material_id=m_encoder.id, quantity_delayed=100, original_eta=d(-2), revised_eta=d(12), delay_days=14, reason="Export customs inspection hold at origin air terminal", status="active", impact_severity="critical"),
            ShipmentDelay(po_number="PO-9921", supplier_id=sup_norden.id, material_id=m_stepper.id, quantity_delayed=80, original_eta=d(1), revised_eta=d(7), delay_days=6, reason="Ocean carrier blank sailing; rebooked to next vessel", status="active", impact_severity="high"),
            ShipmentDelay(po_number="PO-9930", supplier_id=sup_vanguard.id, material_id=m_arm.id, quantity_delayed=60, original_eta=d(3), revised_eta=d(6), delay_days=3, reason="CNC spindle maintenance pushed the finishing run", status="mitigated", impact_severity="medium"),
            ShipmentDelay(po_number="PO-9888", supplier_id=sup_pacific.id, material_id=m_mcu.id, quantity_delayed=200, original_eta=d(-20), revised_eta=d(-15), delay_days=5, reason="Component allocation shortfall at distributor", status="resolved", impact_severity="medium"),
        ])

        db.flush()

        # A past decision for the mitigated disruption, computed by the engine rather than typed in.
        from app.services import engine as recovery_engine  # local import to avoid import cycles at module load
        import json
        mitigated = db.query(ShipmentDelay).filter(ShipmentDelay.po_number == "PO-9930").first()
        analysis = recovery_engine.analyze(db, mitigated)
        chosen = next(s for s in analysis.strategies if s.recommended)
        db.add(RecoveryDecision(
            shipment_delay_id=mitigated.id,
            decided_by_user_id=users[1].id,
            strategy_key=chosen.key,
            strategy_name=chosen.name,
            simulated_delay_days=analysis.simulated_delay_days,
            assumptions_json=json.dumps(analysis.assumptions),
            added_cost=chosen.added_cost,
            remaining_delay_days=chosen.remaining_delay_days,
            late_orders_count=chosen.late_orders_count,
            protected_commitments=chosen.protected_commitments,
            remaining_sla_penalties=chosen.remaining_sla_penalties,
            penalties_avoided=chosen.penalties_avoided,
            net_benefit=chosen.net_benefit,
            revenue_protected=chosen.revenue_protected,
            summary=chosen.explanation,
            note="Vanguard confirmed the finishing run restarts Monday; no customer impact.",
            status="adopted",
            decided_at=datetime.now(timezone.utc) - timedelta(days=1, hours=3),
        ))

        db.commit()
        logger.info("Demonstration data seeded.")
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding database: {e}")
        raise
    finally:
        if close_db:
            db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed SupplyGuard demo data")
    parser.add_argument("--reset", action="store_true", help="Drop all tables and reseed")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    if args.reset:
        reset_database()
    seed_database(force=args.reset)
