from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dashboard import order_risk_map
from app.api.deps import get_current_user
from app.api.orders import with_risk
from app.core.database import get_db
from app.models.customer import Customer
from app.models.disruption import ProductionOrder
from app.schemas.aggregates import CustomerDetail
from app.schemas.customer import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Customers"], dependencies=[Depends(get_current_user)])


def _detail(db: Session, c: Customer, risk: dict) -> CustomerDetail:
    orders = db.query(ProductionOrder).filter(ProductionOrder.customer_id == c.id).order_by(ProductionOrder.committed_delivery_date.asc()).all()
    open_orders = [o for o in orders if o.status != "completed"]
    with_r = [with_risk(o, risk) for o in orders]
    at_risk = [o for o in with_r if o.risk_level in ("critical", "high")]
    base = CustomerResponse.model_validate(c).model_dump()
    return CustomerDetail(
        **base,
        active_order_count=len(open_orders),
        orders_at_risk=len(at_risk),
        open_revenue=round(sum(float(o.revenue_value or 0.0) for o in open_orders), 2),
        penalty_exposure=round(sum(o.sla_penalty for o in with_r), 2),
        next_commitment_date=open_orders[0].committed_delivery_date.isoformat() if open_orders else None,
        orders=with_r,
    )


@router.get("", response_model=List[CustomerDetail])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Customers with tier, SLA terms and computed commitment risk."""
    risk = order_risk_map(db)
    customers = db.query(Customer).order_by(Customer.priority_score.desc()).offset(skip).limit(limit).all()
    return [_detail(db, c, risk) for c in customers]


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer_in: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.code == customer_in.code).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Customer with code '{customer_in.code}' already exists.")
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return _detail(db, customer, order_risk_map(db))
