from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="scheduled", nullable=False)  # scheduled, in_progress, delayed, completed
    planned_start_date = Column(Date, nullable=False)
    planned_completion_date = Column(Date, nullable=False)
    committed_delivery_date = Column(Date, nullable=False)
    revenue_value = Column(Float, default=0.0, nullable=False)
    priority = Column(String(50), default="medium", nullable=False)    # critical, high, medium, low
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    customer = relationship("Customer", back_populates="production_orders")
    materials_required = relationship("ProductionOrderMaterial", back_populates="production_order", cascade="all, delete-orphan")


class ProductionOrderMaterial(Base):
    __tablename__ = "production_order_materials"

    id = Column(Integer, primary_key=True, index=True)
    production_order_id = Column(Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    quantity_required = Column(Integer, nullable=False)
    quantity_allocated = Column(Integer, default=0, nullable=False)

    production_order = relationship("ProductionOrder", back_populates="materials_required")
    material = relationship("Material", back_populates="order_requirements")


class ShipmentDelay(Base):
    __tablename__ = "shipment_delays"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    quantity_delayed = Column(Integer, nullable=False)
    original_eta = Column(Date, nullable=False)
    revised_eta = Column(Date, nullable=False)
    delay_days = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=True)
    status = Column(String(50), default="active", nullable=False)  # active, mitigated, resolved
    impact_severity = Column(String(50), default="high", nullable=False)  # critical, high, medium
    reported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier = relationship("Supplier", back_populates="shipment_delays")
    material = relationship("Material", back_populates="shipment_delays")
    recovery_options = relationship("RecoveryOption", back_populates="shipment_delay", cascade="all, delete-orphan")
    decisions = relationship("RecoveryDecision", back_populates="shipment_delay", cascade="all, delete-orphan", order_by="RecoveryDecision.decided_at.desc()")


class RecoveryOption(Base):
    """What-If War Room recovery options."""
    __tablename__ = "recovery_options"

    id = Column(Integer, primary_key=True, index=True)
    shipment_delay_id = Column(Integer, ForeignKey("shipment_delays.id", ondelete="CASCADE"), nullable=False)
    strategy_name = Column(String(255), nullable=False)  # e.g., "Air Expedite", "Secondary Supplier", "Shift Overtime"
    description = Column(Text, nullable=True)
    additional_cost = Column(Float, default=0.0, nullable=False)
    days_saved = Column(Integer, default=0, nullable=False)
    net_delay_days = Column(Integer, default=0, nullable=False)
    sla_penalty_saved = Column(Float, default=0.0, nullable=False)
    tradeoff_score = Column(Float, default=0.0, nullable=False)  # Net ROI / feasibility ranking
    recommended = Column(Integer, default=0, nullable=False)     # 1 if top recommended

    shipment_delay = relationship("ShipmentDelay", back_populates="recovery_options")



class RecoveryDecision(Base):
    """A recovery plan adopted from the What-If War Room (decision log)."""
    __tablename__ = "recovery_decisions"

    id = Column(Integer, primary_key=True, index=True)
    shipment_delay_id = Column(Integer, ForeignKey("shipment_delays.id", ondelete="CASCADE"), nullable=False, index=True)
    decided_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    strategy_key = Column(String(50), nullable=False)
    strategy_name = Column(String(255), nullable=False)
    simulated_delay_days = Column(Integer, nullable=False)
    assumptions_json = Column(Text, nullable=False, default="{}")
    added_cost = Column(Float, default=0.0, nullable=False)
    remaining_delay_days = Column(Integer, default=0, nullable=False)
    late_orders_count = Column(Integer, default=0, nullable=False)
    protected_commitments = Column(Integer, default=0, nullable=False)
    remaining_sla_penalties = Column(Float, default=0.0, nullable=False)
    penalties_avoided = Column(Float, default=0.0, nullable=False)
    net_benefit = Column(Float, default=0.0, nullable=False)
    revenue_protected = Column(Float, default=0.0, nullable=False)
    summary = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    status = Column(String(50), default="adopted", nullable=False)  # adopted, superseded
    decided_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    shipment_delay = relationship("ShipmentDelay", back_populates="decisions")
    decided_by = relationship("User")
