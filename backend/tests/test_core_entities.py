def test_suppliers_api(client, auth_headers):
    res = client.get("/api/suppliers", headers=auth_headers)
    assert res.status_code == 200
    suppliers = res.json()
    assert len(suppliers) >= 6
    apex = next(s for s in suppliers if s["code"] == "SUP-APX-01")
    assert apex["active_shipment_count"] == 1
    assert apex["total_shipment_count"] == 1

    detail = client.get(f"/api/suppliers/{apex['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["shipments"][0]["po_number"] == "PO-9914"

    shipments = client.get(f"/api/suppliers/{apex['id']}/shipments", headers=auth_headers)
    assert shipments.status_code == 200 and len(shipments.json()) == 1

    new_sup = {"name": "Delta Precision Castings", "code": "SUP-DEL-TEST", "lead_time_days": 10, "on_time_delivery_rate": 0.95, "reliability_score": 9.2}
    create = client.post("/api/suppliers", json=new_sup, headers=auth_headers)
    assert create.status_code == 201
    assert client.post("/api/suppliers", json=new_sup, headers=auth_headers).status_code == 400
    assert client.get("/api/suppliers/99999", headers=auth_headers).status_code == 404


def test_materials_and_inventory_api(client, auth_headers):
    materials = client.get("/api/materials", headers=auth_headers).json()
    assert len(materials) >= 7
    encoder = next(m for m in materials if m["sku"] == "MAT-OPT-SENS")
    assert encoder["alternate_supplier"]["code"] == "SUP-HEL-02"

    inv = client.get("/api/inventory", headers=auth_headers)
    assert inv.status_code == 200
    items = inv.json()
    assert len(items) >= 7
    for i in items:
        assert i["available_stock"] == max(0, i["current_stock"] - i["reserved_stock"])
        expected = "critical" if i["available_stock"] <= 0 else "low" if i["available_stock"] <= i["reorder_point"] else "healthy"
        assert i["stock_status"] == expected
    assert items[0]["stock_status"] == "critical"  # sorted critical first

    low = client.get("/api/inventory?low_stock_only=true", headers=auth_headers).json()
    assert all(i["available_stock"] <= i["reorder_point"] for i in low)

    enc_inv = next(i for i in items if i["material"]["sku"] == "MAT-OPT-SENS")
    patched = client.patch(f"/api/inventory/{enc_inv['id']}", json={"reorder_point": 55}, headers=auth_headers)
    assert patched.status_code == 200 and patched.json()["reorder_point"] == 55
    assert client.patch(f"/api/inventory/{enc_inv['id']}", json={"current_stock": -1}, headers=auth_headers).status_code == 400
    client.patch(f"/api/inventory/{enc_inv['id']}", json={"reorder_point": 50}, headers=auth_headers)


def test_customers_api(client, auth_headers):
    res = client.get("/api/customers", headers=auth_headers)
    assert res.status_code == 200
    customers = res.json()
    assert len(customers) >= 4
    med = next(c for c in customers if "MedTech" in c["name"])
    assert med["active_order_count"] == 2
    assert med["orders_at_risk"] >= 1
    assert med["penalty_exposure"] > 0
    detail = client.get(f"/api/customers/{med['id']}", headers=auth_headers).json()
    assert any(o["order_number"] == "WO-8420" for o in detail["orders"])


def test_orders_api(client, auth_headers):
    res = client.get("/api/orders", headers=auth_headers)
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 8
    wo = next(o for o in orders if o["order_number"] == "WO-8420")
    assert wo["risk_level"] == "critical"
    assert wo["late_days"] > 0
    assert wo["blocking_po_number"] == "PO-9914"
    assert len(wo["materials_required"]) >= 4
    healthy = next(o for o in orders if o["order_number"] == "WO-8419")
    assert healthy["risk_level"] == "low"
    assert client.get(f"/api/orders/{wo['id']}", headers=auth_headers).status_code == 200
    assert client.get("/api/orders/99999", headers=auth_headers).status_code == 404


def test_system_info(client, auth_headers):
    res = client.get("/api/system/info", headers=auth_headers)
    assert res.status_code == 200
    info = res.json()
    assert info["database_dialect"] == "sqlite"
    assert info["using_sqlite_fallback"] is True
    assert info["demo_data"] is True
