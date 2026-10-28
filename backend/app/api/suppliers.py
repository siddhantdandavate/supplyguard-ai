from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.disruption import ShipmentDelay
from app.models.material import Material
from app.models.supplier import Supplier
from app.schemas.aggregates import SupplierDetail
from app.schemas.disruption import ShipmentDelayResponse
from app.schemas.material import MaterialResponse
from app.schemas.supplier import SupplierCreate, SupplierResponse

router = APIRouter(prefix="/suppliers", tags=["Suppliers"], dependencies=[Depends(get_current_user)])


def _detail(db: Session, s: Supplier) -> SupplierDetail:
    shipments = db.query(ShipmentDelay).filter(ShipmentDelay.supplier_id == s.id).order_by(ShipmentDelay.reported_at.desc()).all()
    materials = db.query(Material).filter(Material.supplier_id == s.id).all()
    base = SupplierResponse.model_validate(s).model_dump()
    return SupplierDetail(
        **base,
        active_shipment_count=sum(1 for sh in shipments if sh.status == "active"),
        total_shipment_count=len(shipments),
        materials_supplied=len(materials),
        shipments=[ShipmentDelayResponse.model_validate(sh) for sh in shipments],
        materials=[MaterialResponse.model_validate(m) for m in materials],
    )


@router.get("", response_model=List[SupplierDetail])
def list_suppliers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Suppliers with lead time, reliability and shipment counts."""
    suppliers = db.query(Supplier).order_by(Supplier.name.asc()).offset(skip).limit(limit).all()
    return [_detail(db, s) for s in suppliers]


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_in: SupplierCreate, db: Session = Depends(get_db)):
    existing = db.query(Supplier).filter(Supplier.code == supplier_in.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Supplier with code '{supplier_in.code}' already exists.")
    supplier = Supplier(**supplier_in.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=SupplierDetail)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return _detail(db, supplier)


@router.get("/{supplier_id}/shipments", response_model=List[ShipmentDelayResponse])
def supplier_shipments(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return db.query(ShipmentDelay).filter(ShipmentDelay.supplier_id == supplier_id).order_by(ShipmentDelay.reported_at.desc()).all()
