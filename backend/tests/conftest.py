import os
import sys
from pathlib import Path

# Use an isolated SQLite database for the test session, never the dev database.
TEST_DB = Path(__file__).resolve().parent / "_test_supplyguard.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SQLITE_FALLBACK_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["RESET_DEMO_DATA"] = "true"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # triggers lifespan: reset + seed
        yield c


@pytest.fixture(scope="session")
def auth_headers(client):
    res = client.post("/api/auth/login", json={"email": "planner@supplyguard.io", "password": "password123"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
