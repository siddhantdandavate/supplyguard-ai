from dataclasses import asdict
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_planner_or_admin
from app.core.database import get_db
from app.models.disruption import ShipmentDelay
from app.schemas.scenario import ScenarioRequest, ScenarioResponse, StrategyInfo
from app.services import engine

router = APIRouter(prefix="/scenarios", tags=["What-If War Room"], dependencies=[Depends(require_planner_or_admin)])


@router.get("/strategies", response_model=List[StrategyInfo])
def list_strategies():
    """Recovery strategies the engine can evaluate."""
    return [StrategyInfo(key=k, **engine.STRATEGY_META[k]) for k in engine.STRATEGY_KEYS]


@router.post("/simulate", response_model=ScenarioResponse)
def simulate(req: ScenarioRequest, db: Session = Depends(get_db)):
    """Evaluate all recovery strategies for a disruption under the given assumptions."""
    delay = db.query(ShipmentDelay).filter(ShipmentDelay.id == req.delay_id).first()
    if not delay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disruption not found")

    overrides = req.assumptions.model_dump(exclude_none=True) if req.assumptions else {}
    assumptions = engine.Assumptions(
        delay_days=req.delay_days if req.delay_days is not None else delay.delay_days,
        **overrides,
    )
    analysis = engine.analyze(db, delay, assumptions)
    return ScenarioResponse(**asdict(analysis))
