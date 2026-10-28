from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="General", nullable=False)
    unit_of_measure = Column(String(50), default="PCS", nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    # Qualified secondary source used by the "alternate supplier" recovery strategy (optional).
    alternate_supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    standard_lead_time_days = Column(Integer, default=14, nullable=False)
    safety_stock = Column(Integer, default=50, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    supplier = relationship("Supplier", back_populates="materials", foreign_keys=[supplier_id])
    alternate_supplier = relationship("Supplier", foreign_keys=[alternate_supplier_id])
    inventory = relationship("Inventory", back_populates="material", uselist=False, cascade="all, delete-orphan")
    order_requirements = relationship("ProductionOrderMaterial", back_populates="material")
    shipment_delays = relationship("ShipmentDelay", back_populates="material")
