from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.material import Material
from app.models.inventory import Inventory
from app.schemas.material import MaterialCreate, MaterialResponse

router = APIRouter(prefix="/materials", tags=["Materials"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[MaterialResponse])
def list_materials(
    category: Optional[str] = Query(None, description="Filter by material category"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List bill-of-materials catalog parts."""
    query = db.query(Material)
    if category:
        query = query.filter(Material.category == category)
    return query.order_by(Material.sku.asc()).offset(skip).limit(limit).all()


@router.post("", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(
    material_in: MaterialCreate,
    initial_stock: int = Query(0, ge=0, description="Initial stock level to register"),
    db: Session = Depends(get_db),
):
    """Register a new material and create its inventory record."""
    existing = db.query(Material).filter(Material.sku == material_in.sku).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Material with SKU '{material_in.sku}' already exists.")
    material = Material(**material_in.model_dump())
    db.add(material)
    db.flush()
    db.add(Inventory(material_id=material.id, current_stock=initial_stock, reserved_stock=0, reorder_point=material.safety_stock, location="Main Warehouse"))
    db.commit()
    db.refresh(material)
    return material


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    return material
