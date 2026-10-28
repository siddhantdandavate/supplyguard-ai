from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.supplier import Supplier

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )

    return user


def require_planner_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user has a manufacturing planner, admin, or operator role."""
    if current_user.role not in ("planner", "admin", "operator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to planners and administrators.",
        )
    return current_user


def require_supplier(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user has a supplier role."""
    if current_user.role != "supplier":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to suppliers.",
        )
    return current_user


def get_supplier_for_user(user: User, db: Session) -> Optional[Supplier]:
    """Resolve the Supplier entity associated with a supplier user."""
    if user.supplier_id:
        sup = db.query(Supplier).filter(Supplier.id == user.supplier_id).first()
        if sup:
            return sup
    # Fallback lookup by email matching supplier email
    if user.email:
        sup = db.query(Supplier).filter(Supplier.email == user.email).first()
        if sup:
            return sup
    return None


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    try:
        user_id = int(payload["sub"])
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None
