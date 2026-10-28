import pytest


def _critical(client, auth_headers):
    disruptions = client.get("/api/disruptions", headers=auth_headers).json()
    return next(d for d in disruptions if d["po_number"] == "PO-9914")


def test_disruption_list_has_computed_impact(client, auth_headers):
    res = client.get("/api/disruptions", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 4
    crit = next(d for d in items if d["po_number"] == "PO-9914")
    assert crit["impact_severity"] == "critical"
    assert crit["affected_orders_count"] == 3  # WO-8420, WO-8421, WO-8422 have unfilled encoder demand
    assert crit["late_orders_count"] >= 2
    assert crit["shortage_units"] == 60
    assert crit["sla_penalty_exposure"] > 0
    assert crit["revenue_at_risk"] > 0

    active = client.get("/api/disruptions?status=active", headers=auth_headers).json()
    assert all(d["status"] == "active" for d in active)
    resolved = next(d for d in items if d["status"] == "resolved")
    assert resolved["late_orders_count"] == 0


def test_disruption_detail(client, auth_headers):
    crit = _critical(client, auth_headers)
    res = client.get(f"/api/disruptions/{crit['id']}", headers=auth_headers)
    assert res.status_code == 200
    detail = res.json()
    assert detail["disruption"]["po_number"] == "PO-9914"
    assert detail["inventory"]["available_stock"] == 0
    assert detail["baseline"]["key"] == "baseline"
    assert len(detail["affected_orders"]) == 3
    assert detail["recommended"]["recommended"] is True
    assert detail["recommended"]["key"] != "baseline"
    assert "recommended" in detail["scenario_summary"].lower()
    assert client.get("/api/disruptions/99999", headers=auth_headers).status_code == 404


def test_status_update(client, auth_headers):
    items = client.get("/api/disruptions", headers=auth_headers).json()
    med = next(d for d in items if d["po_number"] == "PO-9930")
    res = client.patch(f"/api/disruptions/{med['id']}/status", json={"status": "resolved"}, headers=auth_headers)
    assert res.status_code == 200 and res.json()["status"] == "resolved"
    assert client.patch(f"/api/disruptions/{med['id']}/status", json={"status": "bogus"}, headers=auth_headers).status_code == 400
    client.patch(f"/api/disruptions/{med['id']}/status", json={"status": "mitigated"}, headers=auth_headers)


def test_strategies_listing(client, auth_headers):
    res = client.get("/api/scenarios/strategies", headers=auth_headers)
    assert res.status_code == 200
    keys = [s["key"] for s in res.json()]
    assert keys == ["baseline", "expedite", "alternate", "reallocation", "combined"]


def test_simulation_default_assumptions(client, auth_headers):
    crit = _critical(client, auth_headers)
    res = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"]}, headers=auth_headers)
    assert res.status_code == 200, res.text
    sim = res.json()
    assert sim["simulated_delay_days"] == 14
    assert sim["free_stock"] == 0
    assert sim["total_unfilled_demand"] == 60
    by_key = {s["key"]: s for s in sim["strategies"]}
    assert set(by_key) == {"baseline", "expedite", "alternate", "reallocation", "combined"}

    base = by_key["baseline"]
    assert base["added_cost"] == 0
    assert base["remaining_delay_days"] == 14
    assert base["penalties_avoided"] == 0
    assert base["late_orders_count"] >= 2

    exp = by_key["expedite"]
    # default: 60% of 14 days = 8 saved; cost = 1500 fixed + 100 units * 0.35 * $36 (=12.6/unit)
    assert exp["days_saved"] == 8
    assert exp["remaining_delay_days"] == 6
    assert exp["added_cost"] == pytest.approx(1500 + 100 * 12.6)
    assert exp["remaining_sla_penalties"] < base["remaining_sla_penalties"]
    assert exp["penalties_avoided"] == pytest.approx(base["remaining_sla_penalties"] - exp["remaining_sla_penalties"])
    assert exp["net_benefit"] == pytest.approx(exp["penalties_avoided"] - exp["added_cost"])

    alt = by_key["alternate"]
    assert sim["assumptions"]["alternate_lead_time_days"] == 9  # Helios Sensorik is the qualified alternate
    assert alt["units_from_alternate"] == 60
    assert alt["added_cost"] == pytest.approx(60 * 36.0 * 0.25)

    # Every strategy's total exposure = cost + remaining penalties; exactly one recommended = lowest exposure
    for s in sim["strategies"]:
        assert s["total_exposure"] == pytest.approx(s["added_cost"] + s["remaining_sla_penalties"])
        assert s["baseline_sla_penalties"] == pytest.approx(base["remaining_sla_penalties"])
    recommended = [s for s in sim["strategies"] if s["recommended"]]
    assert len(recommended) == 1
    assert recommended[0]["key"] == sim["recommended_key"]
    assert recommended[0]["total_exposure"] == min(s["total_exposure"] for s in sim["strategies"])
    assert recommended[0]["explanation"]
    # Combined (expedite + reallocation) is never worse on penalties than expedite alone
    assert by_key["combined"]["remaining_sla_penalties"] <= exp["remaining_sla_penalties"]


def test_simulation_assumptions_change_results(client, auth_headers):
    crit = _critical(client, auth_headers)
    longer = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "delay_days": 28}, headers=auth_headers).json()
    shorter = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "delay_days": 5}, headers=auth_headers).json()
    b_long = next(s for s in longer["strategies"] if s["key"] == "baseline")
    b_short = next(s for s in shorter["strategies"] if s["key"] == "baseline")
    assert b_long["remaining_sla_penalties"] > b_short["remaining_sla_penalties"]
    assert longer["revised_eta"] > shorter["revised_eta"]

    custom = client.post(
        "/api/scenarios/simulate",
        json={"delay_id": crit["id"], "delay_days": 14, "assumptions": {"expedite_days_saved": 12, "expedite_fixed_cost": 0, "expedite_cost_per_unit": 1}},
        headers=auth_headers,
    ).json()
    exp = next(s for s in custom["strategies"] if s["key"] == "expedite")
    assert exp["days_saved"] == 12
    assert exp["remaining_delay_days"] == 2
    assert exp["added_cost"] == pytest.approx(100.0)
    assert custom["assumptions"]["expedite_days_saved"] == 12


def test_simulation_edge_cases(client, auth_headers):
    crit = _critical(client, auth_headers)
    zero = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "delay_days": 0}, headers=auth_headers)
    assert zero.status_code == 200
    z = zero.json()
    exp = next(s for s in z["strategies"] if s["key"] == "expedite")
    assert exp["days_saved"] == 0 and exp["remaining_delay_days"] == 0

    # expedite_days_saved larger than the delay is clamped
    clamped = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "delay_days": 3, "assumptions": {"expedite_days_saved": 50}}, headers=auth_headers).json()
    assert next(s for s in clamped["strategies"] if s["key"] == "expedite")["remaining_delay_days"] == 0

    assert client.post("/api/scenarios/simulate", json={"delay_id": 99999}, headers=auth_headers).status_code == 404
    assert client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "delay_days": -4}, headers=auth_headers).status_code == 422
    assert client.post("/api/scenarios/simulate", json={"delay_id": crit["id"], "assumptions": {"alternate_coverage_pct": 250}}, headers=auth_headers).status_code == 422

    # A resolved disruption with fully allocated demand has no affected orders and recommends baseline
    items = client.get("/api/disruptions", headers=auth_headers).json()
    resolved = next(d for d in items if d["status"] == "resolved")
    sim = client.post("/api/scenarios/simulate", json={"delay_id": resolved["id"]}, headers=auth_headers).json()
    assert sim["total_unfilled_demand"] == 0
    assert sim["recommended_key"] == "baseline"


def test_dashboard_summary(client, auth_headers):
    res = client.get("/api/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    m = data["metrics"]
    assert data["demo_data"] is True
    assert m["delayed_shipments"] == 2
    assert m["critical_shipments"] == 1
    assert m["orders_at_risk"] >= 2
    assert m["critical_shortages"] >= 1
    assert m["sla_penalty_exposure"] > 0
    assert m["commitments_at_risk"] >= 1
    assert len(data["disruptions"]) >= 4
    assert data["critical_orders"][0]["risk_level"] == "critical"
    assert any(e["kind"] == "today" for e in data["timeline"])
    assert data["next_actions"][0]["route"].startswith("/war-room/")


def test_reallocation_releases_stock_from_orders_that_can_wait(client, auth_headers):
    crit = _critical(client, auth_headers)
    sim = client.post("/api/scenarios/simulate", json={"delay_id": crit["id"]}, headers=auth_headers).json()
    by_key = {s["key"]: s for s in sim["strategies"]}
    realloc = by_key["reallocation"]
    # WO-8425 starts after the delayed shipment arrives, so its 10 reserved encoders can be released.
    assert realloc["units_reallocated"] == 10
    assert realloc["shortage_units_immediate"] == 60  # demand moved to the donor, which now waits for supply
    donor = next(o for o in realloc["orders"] if o["role"] == "donor")
    assert donor["order_number"] == "WO-8425" and donor["unfilled_after_pool"] == 10 and not donor["is_late"]
    assert realloc["late_orders_count"] < by_key["baseline"]["late_orders_count"]
    combined = by_key["combined"]
    assert combined["units_reallocated"] == 10 and combined["days_saved"] == 8
    assert combined["total_exposure"] < by_key["expedite"]["total_exposure"]
    assert sim["recommended_key"] == "combined"
