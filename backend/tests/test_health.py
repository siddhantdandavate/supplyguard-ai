def test_get_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database_ok"] is True
    assert body["database"] == "sqlite"
    assert body["version"]
    assert body["environment"] == "development"


def test_security_headers(client):
    response = client.get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "X-Response-Time-Ms" in response.headers


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["database"] == "sqlite"


def test_production_config_validation(monkeypatch):
    from app.core.config import Settings, DEV_SECRET
    import pytest

    prod = Settings(ENVIRONMENT="production", SECRET_KEY=DEV_SECRET)
    with pytest.raises(RuntimeError):
        prod.validate_for_runtime()

    monkeypatch.setenv("CORS_ORIGINS", "https://example.netlify.app")
    ok = Settings(ENVIRONMENT="production", SECRET_KEY="x" * 40, CORS_ORIGINS=["https://example.netlify.app"])
    ok.validate_for_runtime()  # must not raise
