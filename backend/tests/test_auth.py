import uuid


def test_registration_login_and_me(client):
    email = f"planner_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "full_name": "Test Planner", "password": "StrongPassword123!", "role": "planner"}

    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email
    token = data["access_token"]

    assert client.post("/api/auth/register", json=payload).status_code == 400

    login = client.post("/api/auth/login", json={"email": email.upper(), "password": "StrongPassword123!"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email

    assert client.post("/api/auth/login", json={"email": email, "password": "wrong"}).status_code == 401

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Test Planner"

    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_registration_validation(client):
    bad_email = client.post("/api/auth/register", json={"email": "nope", "full_name": "X Y", "password": "StrongPassword123!"})
    assert bad_email.status_code == 422
    short_pw = client.post("/api/auth/register", json={"email": "a@b.co", "full_name": "X Y", "password": "short"})
    assert short_pw.status_code == 422


def test_profile_update_and_password_change(client):
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post("/api/auth/register", json={"email": email, "full_name": "Before Name", "password": "FirstPassword1!"})
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

    upd = client.patch("/api/auth/me", json={"full_name": "After Name"}, headers=headers)
    assert upd.status_code == 200 and upd.json()["full_name"] == "After Name"

    wrong = client.post("/api/auth/change-password", json={"current_password": "nope", "new_password": "SecondPassword2!"}, headers=headers)
    assert wrong.status_code == 400

    ok = client.post("/api/auth/change-password", json={"current_password": "FirstPassword1!", "new_password": "SecondPassword2!"}, headers=headers)
    assert ok.status_code == 204
    assert client.post("/api/auth/login", json={"email": email, "password": "FirstPassword1!"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "SecondPassword2!"}).status_code == 200


def test_protected_routes_require_token(client):
    for path in ["/api/dashboard/summary", "/api/disruptions", "/api/orders", "/api/inventory", "/api/suppliers", "/api/customers", "/api/system/info"]:
        assert client.get(path).status_code == 401, path
    assert client.post("/api/scenarios/simulate", json={"delay_id": 1}).status_code == 401
