from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_stock = Column(Integer, default=0, nullable=False)
    reserved_stock = Column(Integer, default=0, nullable=False)
    reorder_point = Column(Integer, default=20, nullable=False)
    location = Column(String(100), default="Main Warehouse", nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    material = relationship("Material", back_populates="inventory")

    @property
    def available_stock(self) -> int:
        return max(0, self.current_stock - self.reserved_stock)

