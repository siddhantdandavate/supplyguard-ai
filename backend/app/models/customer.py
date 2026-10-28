from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    tier = Column(String(50), default="Tier 2 - Preferred", nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    sla_penalty_per_day = Column(Float, default=250.0, nullable=False)  # Dollar penalty per day delayed
    priority_score = Column(Integer, default=50, nullable=False)        # 1 to 100
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    production_orders = relationship("ProductionOrder", back_populates="customer")

