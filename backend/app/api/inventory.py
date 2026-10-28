from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.inventory import Inventory
from app.schemas.inventory import InventoryResponse, InventoryUpdate

router = APIRouter(prefix="/inventory", tags=["Inventory"], dependencies=[Depends(get_current_user)])


def stock_status(inv: Inventory) -> str:
    if inv.available_stock <= 0:
        return "critical"
    if inv.available_stock <= inv.reorder_point:
        return "low"
    return "healthy"


@router.get("", response_model=List[InventoryResponse])
def list_inventory(low_stock_only: bool = False, db: Session = Depends(get_db)):
    """Stock on hand, reservations, available stock and reorder thresholds."""
    inventories = db.query(Inventory).all()
    if low_stock_only:
        inventories = [inv for inv in inventories if inv.available_stock <= inv.reorder_point]
    inventories.sort(key=lambda i: (0 if stock_status(i) == "critical" else 1 if stock_status(i) == "low" else 2, i.material.sku if i.material else ""))
    return inventories


@router.get("/{inventory_id}", response_model=InventoryResponse)
def get_inventory_item(inventory_id: int, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == inventory_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory record not found")
    return item


@router.patch("/{inventory_id}", response_model=InventoryResponse)
def update_inventory_stock(inventory_id: int, update_data: InventoryUpdate, db: Session = Depends(get_db)):
    """Update stock counts, reservations, reorder point or location."""
    item = db.query(Inventory).filter(Inventory.id == inventory_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory record not found")
    data = update_data.model_dump(exclude_unset=True)
    for field in ("current_stock", "reserved_stock", "reorder_point"):
        if field in data and data[field] is not None and data[field] < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field} cannot be negative.")
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item
