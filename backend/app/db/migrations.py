import logging
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.supplier import Supplier
from app.models.user import User

logger = logging.getLogger("supplyguard.migrations")


def run_migrations():
    """Non-destructive schema migrations and demo supplier provisioning."""
    logger.info("Running schema integrity checks and migrations...")
    Base.metadata.create_all(bind=engine)

    try:
        insp = inspect(engine)
        table_names = insp.get_table_names()

        with engine.connect() as conn:
            if "users" in table_names:
                user_cols = [c["name"] for c in insp.get_columns("users")]
                if "supplier_id" not in user_cols:
                    logger.info("Adding supplier_id column to users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN supplier_id INTEGER"))
                    conn.commit()

            if "shipment_delays" in table_names:
                delay_cols = [c["name"] for c in insp.get_columns("shipment_delays")]
                if "updated_at" not in delay_cols:
                    logger.info("Adding updated_at column to shipment_delays table...")
                    conn.execute(text("ALTER TABLE shipment_delays ADD COLUMN updated_at TIMESTAMP"))
                    conn.commit()
                    conn.execute(text("UPDATE shipment_delays SET updated_at = reported_at WHERE updated_at IS NULL"))
                    conn.commit()
                if "last_updated_by_role" not in delay_cols:
                    logger.info("Adding last_updated_by_role column to shipment_delays table...")
                    conn.execute(text("ALTER TABLE shipment_delays ADD COLUMN last_updated_by_role VARCHAR(50)"))
                    conn.commit()

        # Ensure demo supplier user exists
        db: Session = SessionLocal()
        try:
            sup_apex = db.query(Supplier).filter(Supplier.code == "SUP-APX-01").first()
            if sup_apex:
                supplier_user = db.query(User).filter(User.email == "supplier@apexsensors.example").first()
                if not supplier_user:
                    logger.info("Creating demo supplier user: supplier@apexsensors.example...")
                    supplier_user = User(
                        email="supplier@apexsensors.example",
                        full_name="Wei Zhang (Apex Sensors)",
                        hashed_password=get_password_hash("password123"),
                        role="supplier",
                        supplier_id=sup_apex.id,
                        is_active=True,
                    )
                    db.add(supplier_user)
                    db.commit()
                else:
                    if not supplier_user.supplier_id:
                        supplier_user.supplier_id = sup_apex.id
                        db.commit()
        finally:
            db.close()

        logger.info("Schema migrations and provisioning completed successfully.")
    except Exception as e:
        logger.error(f"Migration error: {e}")

