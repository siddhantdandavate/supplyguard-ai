"""End-to-End Verification Script for Supplier-to-Planner Workflow and What-If War Room.

Tests the complete 9-step scenario:
1. Log in as a supplier.
2. Update a shipment ETA and delay reason.
3. Save the update.
4. Log in as the planner.
5. Confirm that the disruption reflects the updated shipment data.
6. Open the What-If War Room.
7. Confirm that the impact and recommendation use the updated data.
8. Adopt a recovery plan.
9. Confirm that the decision is persisted and reflected in the planner workspace.
"""

import sys
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.disruption import RecoveryDecision, ShipmentDelay, ShipmentUpdateHistory

def run_verification():
    print("=" * 80)
    print("STARTING COMPLETE END-TO-END WORKFLOW VERIFICATION")
    print("=" * 80)

    client = TestClient(app)

    # -------------------------------------------------------------------------
    # Step 1: Log in as a supplier
    # -------------------------------------------------------------------------
    print("\n[Step 1] Logging in as supplier (supplier@apexsensors.example)...")
    res1 = client.post(
        "/api/auth/login",
        json={"email": "supplier@apexsensors.example", "password": "password123"},
    )
    assert res1.status_code == 200, f"Supplier login failed: {res1.text}"
    supplier_auth = res1.json()
    supplier_token = supplier_auth["access_token"]
    supplier_headers = {"Authorization": f"Bearer {supplier_token}"}
    supplier_user = supplier_auth["user"]

    print(f"  [PASS] Supplier authenticated: {supplier_user['full_name']}")
    print(f"  [PASS] User role: {supplier_user['role']}")
    print(f"  [PASS] Linked supplier ID: {supplier_user['supplier_id']}")
    assert supplier_user["role"] == "supplier"
    assert supplier_user["supplier_id"] == 1

    # Verify supplier workspace visibility
    prof_res = client.get("/api/supplier/profile", headers=supplier_headers)
    assert prof_res.status_code == 200
    profile = prof_res.json()
    print(f"  [PASS] Supplier profile: {profile['name']} ({profile['code']})")

    shipments_res = client.get("/api/supplier/shipments", headers=supplier_headers)
    assert shipments_res.status_code == 200
    shipments = shipments_res.json()
    print(f"  [PASS] Supplier assigned shipments count: {len(shipments)}")
    po_numbers = [s["po_number"] for s in shipments]
    print(f"  [PASS] Assigned PO numbers: {po_numbers}")
    assert "PO-9914" in po_numbers, "Expected PO-9914 to be assigned to Apex Sensors"
    for s in shipments:
        assert s["supplier_id"] == 1, f"Found unauthorized shipment for supplier_id {s['supplier_id']}"

    target_shipment = next(s for s in shipments if s["po_number"] == "PO-9914")
    shipment_id = target_shipment["id"]
    original_eta_date = date.fromisoformat(target_shipment["original_eta"])
    print(f"  [PASS] Target shipment found: ID={shipment_id}, PO={target_shipment['po_number']}, Original ETA={target_shipment['original_eta']}")

    # -------------------------------------------------------------------------
    # Step 2 & 3: Update shipment ETA and delay reason, and save
    # -------------------------------------------------------------------------
    print("\n[Step 2 & 3] Updating shipment ETA, delay reason, and affected quantity...")
    # New revised ETA: +18 days from original ETA
    new_revised_eta = original_eta_date + timedelta(days=18)
    delay_reason = "Air freight export customs inspection hold and carrier transshipment delay"
    update_payload = {
        "status": "customs_hold",
        "revised_eta": new_revised_eta.isoformat(),
        "reason": delay_reason,
        "quantity_delayed": 100,
        "note": "Awaiting final customs clearance release at Frankfurt hub on Friday.",
    }
    print(f"  -> Submitting update payload:")
    print(f"     Status: {update_payload['status']}")
    print(f"     Revised ETA: {update_payload['revised_eta']} (+18 days slip)")
    print(f"     Reason: {update_payload['reason']}")
    print(f"     Affected Quantity: {update_payload['quantity_delayed']}")

    patch_res = client.patch(
        f"/api/supplier/shipments/{shipment_id}",
        headers=supplier_headers,
        json=update_payload,
    )
    assert patch_res.status_code == 200, f"Shipment update failed: {patch_res.text}"
    updated_shipment = patch_res.json()

    print(f"  [PASS] Update saved successfully (HTTP 200)")
    print(f"  [PASS] Saved status: {updated_shipment['status']}")
    print(f"  [PASS] Saved revised ETA: {updated_shipment['revised_eta']}")
    print(f"  [PASS] Calculated delay days: {updated_shipment['delay_days']} days")
    print(f"  [PASS] Last updated by role: {updated_shipment['last_updated_by_role']}")
    print(f"  [PASS] Update history count: {len(updated_shipment['update_history'])}")

    assert updated_shipment["revised_eta"] == new_revised_eta.isoformat()
    assert updated_shipment["delay_days"] == 18
    assert updated_shipment["last_updated_by_role"] == "supplier"
    assert len(updated_shipment["update_history"]) >= 1

    latest_history = updated_shipment["update_history"][0]
    print(f"  [PASS] Audit history entry logged: by {latest_history['updated_by_name']} at {latest_history['updated_at']}")
    print(f"     Change: status '{latest_history['previous_status']}' -> '{latest_history['new_status']}'")
    print(f"     ETA: {latest_history['previous_revised_eta']} -> {latest_history['new_revised_eta']}")
    print(f"     Reason: {latest_history['delay_reason']}")

    # -------------------------------------------------------------------------
    # Step 4: Log in as the planner
    # -------------------------------------------------------------------------
    print("\n[Step 4] Logging in as planner (planner@supplyguard.io)...")
    res_planner = client.post(
        "/api/auth/login",
        json={"email": "planner@supplyguard.io", "password": "password123"},
    )
    assert res_planner.status_code == 200, f"Planner login failed: {res_planner.text}"
    planner_auth = res_planner.json()
    planner_token = planner_auth["access_token"]
    planner_headers = {"Authorization": f"Bearer {planner_token}"}
    planner_user = planner_auth["user"]

    print(f"  [PASS] Planner authenticated: {planner_user['full_name']}")
    print(f"  [PASS] User role: {planner_user['role']}")
    assert planner_user["role"] == "planner"

    # -------------------------------------------------------------------------
    # Step 5: Confirm disruption reflects updated shipment data
    # -------------------------------------------------------------------------
    print("\n[Step 5] Confirming disruption reflects updated shipment data in planner workspace...")
    disruption_res = client.get(f"/api/disruptions/{shipment_id}", headers=planner_headers)
    assert disruption_res.status_code == 200, f"Fetch disruption failed: {disruption_res.text}"
    disruption_data = disruption_res.json()
    disruption_obj = disruption_data["disruption"]
    summary_obj = disruption_data["summary"]

    print(f"  [PASS] Disruption API response received:")
    print(f"     PO Number: {disruption_obj['po_number']}")
    print(f"     Revised ETA: {disruption_obj['revised_eta']} (matches {new_revised_eta.isoformat()})")
    print(f"     Delay Days: {disruption_obj['delay_days']} days (was 14, now recalculated to 18)")
    print(f"     Reason: {disruption_obj['reason']}")
    print(f"     Last updated by role: {disruption_obj['last_updated_by_role']}")
    print(f"     Updated at: {disruption_obj['updated_at']}")

    assert disruption_obj["revised_eta"] == new_revised_eta.isoformat()
    assert disruption_obj["delay_days"] == 18
    assert disruption_obj["last_updated_by_role"] == "supplier"
    assert summary_obj["last_updated_by_role"] == "supplier"
    assert summary_obj["delay_days"] == 18

    # Check Planner Dashboard Summary
    dash_res = client.get("/api/dashboard/summary", headers=planner_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    dash_disruption = next(d for d in dash_data["disruptions"] if d["id"] == shipment_id)

    print(f"  [PASS] Planner Dashboard Summary reflects update:")
    print(f"     Disruption ID: {dash_disruption['id']}")
    print(f"     Revised ETA: {dash_disruption['revised_eta']}")
    print(f"     Delay Days: {dash_disruption['delay_days']}")
    print(f"     Last updated by role: {dash_disruption['last_updated_by_role']}")
    print(f"     Last update reason: {dash_disruption['last_update_reason']}")
    print(f"     Total SLA penalty exposure: ${dash_disruption['sla_penalty_exposure']:,.2f}")
    assert dash_disruption["delay_days"] == 18
    assert dash_disruption["last_updated_by_role"] == "supplier"

    # -------------------------------------------------------------------------
    # Step 6 & 7: Open What-If War Room and confirm updated calculations
    # -------------------------------------------------------------------------
    print("\n[Step 6 & 7] Simulating What-If War Room with updated shipment data...")
    sim_res = client.post(
        "/api/scenarios/simulate",
        headers=planner_headers,
        json={"delay_id": shipment_id, "delay_days": 18},
    )
    assert sim_res.status_code == 200, f"Simulation failed: {sim_res.text}"
    sim_data = sim_res.json()

    baseline = next(s for s in sim_data["strategies"] if s["key"] == "baseline")
    rec = next(s for s in sim_data["strategies"] if s["key"] == sim_data["recommended_key"])

    print(f"  [PASS] War Room simulation results:")
    print(f"     PO Number: {sim_data['po_number']}")
    print(f"     Reported delay days: {sim_data['reported_delay_days']}")
    print(f"     Simulated delay days: {sim_data['simulated_delay_days']}")
    print(f"     Material short: {sim_data['material_name']} ({sim_data['total_unfilled_demand']} units)")
    print(f"     Affected production orders: {baseline['affected_orders_count']}")
    print(f"     Recommended strategy: '{rec['name']}' (key: {sim_data['recommended_key']})")
    print(f"     Executive summary: {sim_data['summary']}")

    assert sim_data["reported_delay_days"] == 18
    assert sim_data["simulated_delay_days"] == 18
    assert len(sim_data["strategies"]) == 5

    print(f"  [PASS] Baseline Strategy (Accept Delay):")
    print(f"     Remaining delay: {baseline['remaining_delay_days']} days")
    print(f"     Late orders: {baseline['late_orders_count']} / {baseline['affected_orders_count']}")
    print(f"     Total SLA Penalties: ${baseline['remaining_sla_penalties']:,.2f}")
    print(f"     Total Exposure: ${baseline['total_exposure']:,.2f}")

    print(f"  [PASS] Recommended Strategy ({rec['name']}):")
    print(f"     Added recovery cost: ${rec['added_cost']:,.2f}")
    print(f"     Days saved: {rec['days_saved']} days")
    print(f"     Remaining late orders: {rec['late_orders_count']} / {rec['affected_orders_count']}")
    print(f"     Penalties avoided: ${rec['penalties_avoided']:,.2f}")
    print(f"     Protected commitments: {rec['protected_commitments']}")
    print(f"     Net benefit vs baseline: ${rec['net_benefit']:,.2f}")

    # Confirm dynamic calculations
    assert rec["net_benefit"] > 0, "Recommended strategy should have a positive net benefit vs baseline"
    assert rec["penalties_avoided"] > 0, "Recommended strategy should avoid SLA penalties"

    # -------------------------------------------------------------------------
    # Step 8: Adopt a recovery plan
    # -------------------------------------------------------------------------
    print(f"\n[Step 8] Adopting recommended recovery plan ('{rec['name']}')...")
    adopt_payload = {
        "strategy_key": rec["key"],
        "delay_days": 18,
        "assumptions": {},
        "note": f"Adopted plan '{rec['name']}' in War Room after supplier updated ETA to +18 days.",
    }
    adopt_res = client.post(
        f"/api/disruptions/{shipment_id}/decisions",
        headers=planner_headers,
        json=adopt_payload,
    )
    assert adopt_res.status_code in (200, 201), f"Adopt decision failed: {adopt_res.text}"
    adopted_decision = adopt_res.json()

    print(f"  [PASS] Plan adopted successfully (HTTP 200)")
    print(f"     Decision ID: {adopted_decision['id']}")
    print(f"     Strategy key: {adopted_decision['strategy_key']}")
    print(f"     Strategy name: {adopted_decision['strategy_name']}")
    print(f"     Added cost: ${adopted_decision['added_cost']:,.2f}")
    print(f"     SLA penalties avoided: ${adopted_decision['penalties_avoided']:,.2f}")
    print(f"     Net benefit: ${adopted_decision['net_benefit']:,.2f}")
    print(f"     Status: {adopted_decision['status']}")
    print(f"     Decided at: {adopted_decision['decided_at']}")

    assert adopted_decision["strategy_key"] == rec["key"]
    assert adopted_decision["status"] == "adopted"

    # -------------------------------------------------------------------------
    # Step 9: Confirm decision is persisted and reflected in planner workspace
    # -------------------------------------------------------------------------
    print("\n[Step 9] Verifying decision persistence and reflection in planner workspace...")
    # 9a. Check decision log for disruption
    decisions_res = client.get(f"/api/disruptions/{shipment_id}/decisions", headers=planner_headers)
    assert decisions_res.status_code == 200
    decisions_list = decisions_res.json()
    assert len(decisions_list) >= 1
    persisted = decisions_list[0]
    print(f"  [PASS] Decision found in disruption audit log:")
    print(f"     ID: {persisted['id']}, Strategy: {persisted['strategy_name']}, Status: {persisted['status']}")
    assert persisted["id"] == adopted_decision["id"]
    assert persisted["status"] == "adopted"

    # 9b. Check disruption status has transitioned to 'mitigated'
    disp_after_res = client.get(f"/api/disruptions/{shipment_id}", headers=planner_headers)
    assert disp_after_res.status_code == 200
    disp_after = disp_after_res.json()["disruption"]
    print(f"  [PASS] Disruption status in planner workspace: '{disp_after['status']}'")
    assert disp_after["status"] == "mitigated", f"Expected disruption status to be 'mitigated', got {disp_after['status']}"

    # 9c. Check all decisions endpoint
    all_dec_res = client.get("/api/disruptions/decisions", headers=planner_headers)
    assert all_dec_res.status_code == 200
    all_decisions = all_dec_res.json()
    assert any(d["id"] == adopted_decision["id"] for d in all_decisions)
    print(f"  [PASS] Decision confirmed in global decisions audit register ({len(all_decisions)} total decisions)")

    # -------------------------------------------------------------------------
    # Clean up restored state so test database remains intact
    # -------------------------------------------------------------------------
    print("\n[Cleanup] Restoring disruption 1 to 14-day delay and cleaning test decision...")
    db = SessionLocal()
    try:
        # Delete the adopted decision from this test run
        db.query(RecoveryDecision).filter(RecoveryDecision.id == adopted_decision["id"]).delete()
        # Delete the update history created during this test run
        db.query(ShipmentUpdateHistory).filter(ShipmentUpdateHistory.id == latest_history["id"]).delete()
        # Restore shipment delay 1
        d1 = db.query(ShipmentDelay).filter(ShipmentDelay.id == shipment_id).first()
        if d1:
            d1.delay_days = 14
            d1.revised_eta = date(2026, 11, 2)
            d1.status = "active"
            d1.reason = "Air freight export customs inspection hold at Frankfurt terminal"
            d1.impact_severity = "critical"
            d1.last_updated_by_role = "supplier"
        db.commit()
        print("  [PASS] Test data cleaned up successfully.")
    finally:
        db.close()

    print("\n" + "=" * 80)
    print("ALL 9 STEPS IN END-TO-END WORKFLOW VERIFIED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_verification()
