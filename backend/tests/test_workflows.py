from datetime import date, timedelta


def _disruptions(client, auth_headers):
    return client.get("/api/disruptions", headers=auth_headers).json()


def test_seeded_decision_log(client, auth_headers):
    res = client.get("/api/disruptions/decisions", headers=auth_headers)
    assert res.status_code == 200
    log = res.json()
    assert len(log) >= 1
    assert log[0]["po_number"] == "PO-9930"
    assert log[0]["decided_by_name"] == "Marcus Vance"
    assert log[0]["status"] == "adopted"
    dash = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert dash["recent_decisions"][0]["po_number"] == "PO-9930"
    mitigated = next(d for d in _disruptions(client, auth_headers) if d["po_number"] == "PO-9930")
    assert mitigated["adopted_strategy"]


def test_adopt_decision_persists_and_supersedes(client, auth_headers):
    crit = next(d for d in _disruptions(client, auth_headers) if d["po_number"] == "PO-9914")
    first = client.post(f"/api/disruptions/{crit['id']}/decisions", json={"strategy_key": "expedite", "delay_days": 14, "note": "Carrier confirmed"}, headers=auth_headers)
    assert first.status_code == 201, first.text
    d1 = first.json()
    assert d1["strategy_key"] == "expedite" and d1["status"] == "adopted"
    assert d1["added_cost"] > 0 and d1["penalties_avoided"] > 0
    assert d1["decided_by_name"] == "Sarah Jenkins"
    assert d1["assumptions"]["expedite_days_saved"] == 8
    assert d1["note"] == "Carrier confirmed"

    detail = client.get(f"/api/disruptions/{crit['id']}", headers=auth_headers).json()
    assert detail["disruption"]["status"] == "mitigated"
    assert detail["decisions"][0]["id"] == d1["id"]

    second = client.post(f"/api/disruptions/{crit['id']}/decisions", json={"strategy_key": "combined", "assumptions": {"expedite_days_saved": 12}}, headers=auth_headers)
    assert second.status_code == 201
    d2 = second.json()
    assert d2["assumptions"]["expedite_days_saved"] == 12
    decisions = client.get(f"/api/disruptions/{crit['id']}/decisions", headers=auth_headers).json()
    statuses = {d["id"]: d["status"] for d in decisions}
    assert statuses[d1["id"]] == "superseded" and statuses[d2["id"]] == "adopted"

    assert client.post(f"/api/disruptions/{crit['id']}/decisions", json={"strategy_key": "magic"}, headers=auth_headers).status_code == 422
    assert client.post("/api/disruptions/99999/decisions", json={"strategy_key": "expedite"}, headers=auth_headers).status_code == 404

    # restore demo state
    client.patch(f"/api/disruptions/{crit['id']}/status", json={"status": "active"}, headers=auth_headers)


def test_report_disruption_computes_severity(client, auth_headers):
    suppliers = client.get("/api/suppliers", headers=auth_headers).json()
    materials = client.get("/api/materials", headers=auth_headers).json()
    titan = next(s for s in suppliers if s["code"] == "SUP-TIT-05")
    fastener = next(m for m in materials if m["sku"] == "MAT-M5-FAST")
    today = date.today()
    payload = {
        "po_number": "po-test-01",
        "supplier_id": titan["id"],
        "material_id": fastener["id"],
        "quantity_delayed": 500,
        "original_eta": (today + timedelta(days=2)).isoformat(),
        "revised_eta": (today + timedelta(days=9)).isoformat(),
        "reason": "Truck breakdown",
    }
    res = client.post("/api/disruptions", json=payload, headers=auth_headers)
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["po_number"] == "PO-TEST-01"
    assert created["delay_days"] == 7
    assert created["status"] == "active"
    # Fasteners are fully allocated with plenty of free stock: nobody is late, so severity is medium.
    assert created["late_orders_count"] == 0
    assert created["impact_severity"] == "medium"
    assert created["recommended_strategy"]

    assert client.post("/api/disruptions", json=payload, headers=auth_headers).status_code == 400
    bad_dates = dict(payload, po_number="PO-TEST-02", revised_eta=payload["original_eta"], original_eta=payload["revised_eta"])
    assert client.post("/api/disruptions", json=bad_dates, headers=auth_headers).status_code == 422
    assert client.post("/api/disruptions", json=dict(payload, po_number="PO-TEST-03", supplier_id=99999), headers=auth_headers).status_code == 400

    # A delay on a material with real shortages is classified critical from its impact
    apex = next(s for s in suppliers if s["code"] == "SUP-APX-01")
    encoder = next(m for m in materials if m["sku"] == "MAT-OPT-SENS")
    res2 = client.post("/api/disruptions", json=dict(payload, po_number="PO-TEST-04", supplier_id=apex["id"], material_id=encoder["id"], original_eta=(today - timedelta(days=1)).isoformat(), revised_eta=(today + timedelta(days=15)).isoformat()), headers=auth_headers)
    assert res2.status_code == 201
    assert res2.json()["impact_severity"] == "critical"
    for po in ("PO-TEST-01", "PO-TEST-04"):
        d = next(x for x in _disruptions(client, auth_headers) if x["po_number"] == po)
        client.patch(f"/api/disruptions/{d['id']}/status", json={"status": "resolved"}, headers=auth_headers)


def test_order_status_update(client, auth_headers):
    orders = client.get("/api/orders", headers=auth_headers).json()
    wo = next(o for o in orders if o["order_number"] == "WO-8423")
    res = client.patch(f"/api/orders/{wo['id']}/status", json={"status": "completed"}, headers=auth_headers)
    assert res.status_code == 200 and res.json()["status"] == "completed"
    assert client.patch(f"/api/orders/{wo['id']}/status", json={"status": "nope"}, headers=auth_headers).status_code == 400
    assert client.patch("/api/orders/99999/status", json={"status": "completed"}, headers=auth_headers).status_code == 404
    client.patch(f"/api/orders/{wo['id']}/status", json={"status": "in_progress"}, headers=auth_headers)
