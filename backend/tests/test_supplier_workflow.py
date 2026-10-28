from datetime import date, timedelta
import pytest


@pytest.fixture
def supplier_auth_headers(client):
    res = client.post("/api/auth/login", json={"email": "supplier@apexsensors.example", "password": "password123"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_supplier_login_and_role(client, supplier_auth_headers):
    res = client.get("/api/auth/me", headers=supplier_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "supplier"
    assert data["supplier_id"] == 1


def test_supplier_cannot_access_planner_endpoints(client, supplier_auth_headers):
    # Planner/Admin restricted endpoints
    restricted_urls = [
        "/api/dashboard/summary",
        "/api/orders",
        "/api/inventory",
        "/api/customers",
        "/api/suppliers",
        "/api/disruptions",
    ]
    for url in restricted_urls:
        res = client.get(url, headers=supplier_auth_headers)
        assert res.status_code == 403, f"{url} should be forbidden for supplier role, got {res.status_code}"


def test_supplier_workspace_shipments(client, supplier_auth_headers):
    # Supplier should see their profile
    res = client.get("/api/supplier/profile", headers=supplier_auth_headers)
    assert res.status_code == 200
    profile = res.json()
    assert profile["code"] == "SUP-APX-01"

    # Supplier should see only their assigned shipments
    res = client.get("/api/supplier/shipments", headers=supplier_auth_headers)
    assert res.status_code == 200
    shipments = res.json()
    assert len(shipments) >= 1
    # All shipments must belong to Apex Precision Sensors (supplier_id == 1)
    for s in shipments:
        assert s["supplier_id"] == 1
        assert "po_number" in s
        assert "material" in s
        assert "quantity_delayed" in s
        assert "original_eta" in s
        assert "revised_eta" in s

    # Ensure PO-9921 (which belongs to Norden Motion Drives, supplier_id 6) is NOT in the list
    po_numbers = [s["po_number"] for s in shipments]
    assert "PO-9914" in po_numbers
    assert "PO-9921" not in po_numbers


def test_supplier_cannot_update_other_supplier_shipment(client, supplier_auth_headers):
    # PO-9921 has delay_id 2 (supplier_id 6)
    res = client.patch(
        "/api/supplier/shipments/2",
        headers=supplier_auth_headers,
        json={"reason": "Hacking someone else's shipment"},
    )
    assert res.status_code in (403, 404)


def test_supplier_update_shipment_and_planner_workflow(client, supplier_auth_headers, auth_headers):
    # 1. Supplier fetches their shipment (PO-9914, delay_id 1)
    res = client.get("/api/supplier/shipments/1", headers=supplier_auth_headers)
    assert res.status_code == 200
    shipment_before = res.json()
    orig_eta = date.fromisoformat(shipment_before["original_eta"])

    # 2. Supplier submits revised ETA (+20 days from original ETA) and delay reason
    new_revised_eta = orig_eta + timedelta(days=20)
    update_payload = {
        "status": "customs_hold",
        "revised_eta": new_revised_eta.isoformat(),
        "reason": "Air freight export customs inspection hold at Frankfurt terminal",
        "quantity_delayed": 100,
        "note": "Customs clearance broker estimated release on Monday.",
    }
    update_res = client.patch("/api/supplier/shipments/1", headers=supplier_auth_headers, json=update_payload)
    assert update_res.status_code == 200
    updated_shipment = update_res.json()
    assert updated_shipment["status"] == "customs_hold"
    assert updated_shipment["revised_eta"] == new_revised_eta.isoformat()
    assert updated_shipment["delay_days"] == 20
    assert updated_shipment["reason"] == update_payload["reason"]
    assert updated_shipment["last_updated_by_role"] == "supplier"
    assert len(updated_shipment["update_history"]) >= 1

    latest_history = updated_shipment["update_history"][0]
    assert latest_history["new_status"] == "customs_hold"
    assert latest_history["new_revised_eta"] == new_revised_eta.isoformat()
    assert latest_history["delay_reason"] == update_payload["reason"]

    # 3. Planner verifies disruption reflects updated shipment data
    planner_res = client.get("/api/disruptions/1", headers=auth_headers)
    assert planner_res.status_code == 200
    planner_view = planner_res.json()
    assert planner_view["disruption"]["revised_eta"] == new_revised_eta.isoformat()
    assert planner_view["disruption"]["delay_days"] == 20
    assert planner_view["disruption"]["reason"] == update_payload["reason"]
    assert planner_view["summary"]["revised_eta"] == new_revised_eta.isoformat()
    assert planner_view["summary"]["delay_days"] == 20
    assert planner_view["summary"]["last_updated_by_role"] == "supplier"

    # 4. Planner dashboard reflects recalculated impact
    dash_res = client.get("/api/dashboard/summary", headers=auth_headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()
    d1 = next(d for d in dash["disruptions"] if d["id"] == 1)
    assert d1["revised_eta"] == new_revised_eta.isoformat()
    assert d1["delay_days"] == 20
    assert d1["last_updated_by_role"] == "supplier"

    # 5. War Room simulation reflects the 20-day delay
    sim_res = client.post("/api/scenarios/simulate", headers=auth_headers, json={"delay_id": 1})
    assert sim_res.status_code == 200
    sim = sim_res.json()
    assert sim["reported_delay_days"] == 20
    assert sim["simulated_delay_days"] == 20

    # 6. Planner adopts recovery plan
    try:
        adopt_res = client.post(
            "/api/disruptions/1/decisions",
            headers=auth_headers,
            json={"strategy_key": sim["recommended_key"], "note": "Approved plan following supplier customs delay update"},
        )
        assert adopt_res.status_code == 201
        decision = adopt_res.json()
        assert decision["strategy_key"] == sim["recommended_key"]
        assert decision["status"] == "adopted"
    finally:
        # Clean up decision on disruption 1 and revert to 14 days so other tests stay isolated
        from app.core.database import SessionLocal
        from app.models.disruption import RecoveryDecision, ShipmentDelay
        db = SessionLocal()
        try:
            db.query(RecoveryDecision).filter(RecoveryDecision.shipment_delay_id == 1).delete()
            d = db.query(ShipmentDelay).filter(ShipmentDelay.id == 1).first()
            if d:
                d.delay_days = 14
                d.revised_eta = d.original_eta + timedelta(days=14)
                d.status = "active"
                d.impact_severity = "critical"
                d.reason = "Export customs inspection hold at origin air terminal"
            db.commit()
        finally:
            db.close()
