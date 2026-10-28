from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    lead_time_days = Column(Integer, default=14, nullable=False)
    on_time_delivery_rate = Column(Float, default=0.90, nullable=False)  # 0.0 to 1.0
    reliability_score = Column(Float, default=8.5, nullable=False)      # 1 to 10 scale
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    materials = relationship(
        "Material",
        back_populates="supplier",
        cascade="all, delete-orphan",
        foreign_keys="Material.supplier_id",
    )
    shipment_delays = relationship("ShipmentDelay", back_populates="supplier")
