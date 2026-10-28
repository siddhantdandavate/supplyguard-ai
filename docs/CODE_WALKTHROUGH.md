# SupplyGuard AI — Code Walkthrough

This document explains the whole codebase so that anyone on the team can present it, answer questions about it, or extend it. Read it top to bottom once; afterwards each section works as a reference.

**Repository:** `backend/` (Python, FastAPI) and `frontend/` (React, TypeScript). Root files: `netlify.toml` (frontend hosting), `render.yaml` (API hosting), `.github/workflows/ci.yml` (tests + build), `README.md` (product and setup).

---

## 1. The one-paragraph version

A planner logs in. The React app calls the FastAPI backend with a JWT. The backend reads suppliers, materials, inventory, customers, production orders (with bill-of-materials lines) and shipment delays from the database. For every delayed shipment, a deterministic **engine** computes who is short, which orders finish late and what that costs, then evaluates five recovery strategies and recommends the cheapest total exposure. The dashboard, disruption pages and the What-If War Room are views over that engine. Adopted plans are stored as decisions.

---

## 2. Request lifecycle (how a click becomes numbers)

```
User action in a page component
   → src/services/api.ts (fetch, adds Authorization: Bearer <token>)
      → FastAPI router in backend/app/api/*.py (dependency: get_current_user)
         → SQLAlchemy session (backend/app/core/database.py)
         → engine functions (backend/app/services/engine.py) when impact is needed
      ← Pydantic response schema (backend/app/schemas/*.py) serialised to JSON
   ← typed result (src/types/api.ts) rendered by the page
```

Two cross-cutting rules:

1. **Every data route requires a valid JWT.** Routers declare `dependencies=[Depends(get_current_user)]`. Only `/api/health`, `/api/auth/login` and `/api/auth/register` are public.
2. **Nothing numeric is hardcoded in the UI.** Pages render what the API returns; the API computes from the database.

---

## 3. Backend

### 3.1 Entry point — `backend/app/main.py`

- Creates the FastAPI app with a **lifespan** handler that runs at startup: validates configuration (`settings.validate_for_runtime()`), optionally resets the schema (`RESET_DEMO_DATA`), creates tables (`Base.metadata.create_all`) and seeds demo data (`SEED_DEMO_DATA`).
- Adds **CORS** for the configured origins.
- Adds a **security-headers middleware** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`, `X-Response-Time-Ms`, HSTS in production).
- A catch-all exception handler logs the stack trace and returns a generic 500 body so internals never leak.
- Mounts all routers under `/api` and serves `/` with name, version, environment and database dialect.
- Interactive docs at `/docs` are on in development and opt-in in production (`ENABLE_DOCS`).

### 3.2 Configuration — `backend/app/core/config.py`

`Settings` is a Pydantic model populated from environment variables (a `.env` file is loaded with python-dotenv). Important fields:

| Field | Purpose |
|---|---|
| `ENVIRONMENT` | `development` or `production` |
| `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT signing |
| `DATABASE_URL`, `SQLITE_FALLBACK_URL`, `ALLOW_SQLITE_FALLBACK` | database selection |
| `SEED_DEMO_DATA`, `RESET_DEMO_DATA` | demo data behaviour |
| `ENABLE_DOCS`, `CORS_ORIGINS` | exposure controls |

`validate_for_runtime()` is the production guard: it raises if the secret is the development default or too short, or if `CORS_ORIGINS` was not set explicitly.

### 3.3 Database — `backend/app/core/database.py`

`create_app_engine()` tries PostgreSQL first (normalising `postgres://` URLs that some hosts emit). If the connection fails it falls back to SQLite — unless production has `ALLOW_SQLITE_FALLBACK=false`, in which case it raises. `SessionLocal` creates sessions; `get_db()` is the FastAPI dependency that opens and closes one per request. `Base` is the declarative base all models extend.

### 3.4 Security — `backend/app/core/security.py`

- `get_password_hash` / `verify_password` use **bcrypt** directly (12 rounds).
- `create_access_token` signs an HS256 JWT with `sub` (user id), `iat`, `exp` and extra claims (email, role).
- `decode_access_token` returns the payload or `None` on any failure.

`backend/app/api/deps.py` turns that into `get_current_user`: reads the bearer token (`OAuth2PasswordBearer`), decodes it, loads the `User`, rejects missing/invalid tokens with 401 and inactive accounts with 403.

### 3.5 Data model — `backend/app/models/`

| Model (table) | Key fields | Relationships |
|---|---|---|
| `User` (`users`) | email, hashed_password, full_name, role, is_active | — |
| `Supplier` (`suppliers`) | code, lead_time_days, on_time_delivery_rate, reliability_score, contact fields | materials, shipment_delays |
| `Material` (`materials`) | sku, name, category, unit_cost, standard_lead_time_days, safety_stock, `supplier_id`, `alternate_supplier_id` | supplier, alternate_supplier, inventory (1:1), order_requirements, shipment_delays |
| `Inventory` (`inventories`) | current_stock, reserved_stock, reorder_point, location; property `available_stock = max(0, current − reserved)` | material |
| `Customer` (`customers`) | code, tier, sla_penalty_per_day, priority_score | production_orders |
| `ProductionOrder` (`production_orders`) | order_number, product_name, quantity, status, planned_start/completion, committed_delivery_date, revenue_value, priority | customer, materials_required |
| `ProductionOrderMaterial` (`production_order_materials`) | quantity_required, quantity_allocated | production_order, material — this is the **bill of materials line** |
| `ShipmentDelay` (`shipment_delays`) | po_number, quantity_delayed, original_eta, revised_eta, delay_days, reason, status (active/mitigated/resolved), impact_severity | supplier, material, decisions |
| `RecoveryDecision` (`recovery_decisions`) | strategy_key/name, simulated_delay_days, assumptions_json, cost and outcome fields, note, status (adopted/superseded), decided_at | shipment_delay, decided_by (User) |
| `RecoveryOption` | legacy table from the foundation; not used by the engine | — |

The important relationship for the engine: **Material ← ProductionOrderMaterial → ProductionOrder → Customer**. A delayed shipment names a material; the BOM lines tell us which orders need it and how much is still unallocated.

### 3.6 Schemas — `backend/app/schemas/`

Pydantic models for request validation and response shaping. Highlights:

- `user.py`: `UserCreate` validates email format, password length 8–72 and allowed roles; `UserUpdate`, `PasswordChange`, `Token`.
- `scenario.py`: `ScenarioRequest` (delay id, optional delay days, optional assumption overrides with bounds) and the response trio `ScenarioResponse` → `StrategyOutcomeOut` → `OrderOutcomeOut`.
- `dashboard.py`: `DashboardSummary` with metrics, disruption summaries, critical orders, timeline events, next actions, recent decisions.
- `decision.py`: `DecisionCreate` (strategy key pattern, delay, assumptions, note), `DecisionResponse`, `DisruptionCreate` (validates revised ETA ≥ original ETA).
- `aggregates.py`: composite responses (`ProductionOrderWithRisk`, `SupplierDetail`, `CustomerDetail`) kept in one module to avoid import cycles.
- `inventory.py`: `InventoryResponse` has a computed `stock_status` (critical / low / healthy).

### 3.7 The engine — `backend/app/services/engine.py`

This is the heart of the product. Everything is deterministic; the module docstring documents the model and assumptions.

**Inputs:** a `ShipmentDelay` and an `Assumptions` dataclass (`delay_days` plus optional overrides). `Assumptions.resolved()` fills defaults from data:

- `expedite_days_saved` = 60 % of the delay (never more than delay − 1)
- `expedite_cost_per_unit` = max($1.50, 35 % of unit cost); `expedite_fixed_cost` = $1,500
- `alternate_lead_time_days` = the material's qualified alternate supplier's lead time, else the fastest other supplier
- `alternate_price_premium_pct` = 25 %, `alternate_coverage_pct` = 100 %
- `reallocation_handling_cost_per_unit` = $2

**`evaluate_strategy(db, delay, key, assumptions)`** — one strategy, step by step:

1. `open_requirements()` loads BOM lines for the material on orders that are not completed; sort them by customer priority (desc) then committed date.
2. `unfilled_before[order] = required − allocated`.
3. Baseline supply event: `(original_eta + delay_days, quantity_delayed)`. For **expedite / combined** the arrival moves earlier by `expedite_days_saved` and cost is added.
4. `_allocate()` gives free stock (`inventory.available_stock`) to unfilled demand in priority order.
5. **Reallocation / combined**: find *donor* orders — orders holding allocated units whose projected completion, if they waited for the main arrival, would still meet their committed date, and which are lower priority than at least one still-unfilled order. Their allocated units go back to the pool and are re-allocated to needy orders; the donors now depend on incoming supply. Cost = units moved × handling cost.
6. **Alternate**: add a second supply event `(today + alternate lead time, coverage % of the remaining shortage)` and charge the price premium.
7. `_cover_dates()` walks supply events in date order and records the date each order's demand is fully covered.
8. For each order: `projected = max(planned_completion, cover_date + remaining_build_days)`; `late_days = max(0, projected − committed)`; `penalty = late_days × customer.sla_penalty_per_day`. Sum penalties, count late orders, revenue at risk, protected commitments.
9. Return a `StrategyOutcome` with cost, remaining delay, days saved, shortages, counts, penalties, revenue, `total_exposure = cost + remaining penalties`, per-order outcomes and operational risks.

**`analyze(db, delay, assumptions)`** runs all five strategies, fills `penalties_avoided` and `net_benefit` relative to baseline, appends risk notes, sorts by `(total_exposure, late_orders, cost)` and marks the first as `recommended`. `_explain()` builds the natural-language explanation from the numbers (no AI).

**`baseline_impact(db, delay)`** is the cheap call used by list views and the dashboard.

Worked example from the seed data (PO-9914, encoders, 14 days late): free stock 0, unfilled demand 60 → baseline penalties $30,600 on 3 late orders. Expedite saves 8 days for $2,760 and leaves $5,400. Reallocation frees 10 units from WO-8425 (it starts after the shipment arrives) and makes WO-8421 on time. Combined therefore reaches $2,780 cost + $2,400 penalties = $5,180 total exposure, the lowest, so it is recommended.

### 3.8 Routers — `backend/app/api/`

| File | Prefix | Endpoints |
|---|---|---|
| `health.py` | `/health` | GET: liveness + DB readiness (503 when the DB fails) |
| `auth.py` | `/auth` | POST register, POST login, GET me, PATCH me (display name), POST change-password |
| `system.py` | `/system/info` | runtime info for Settings (dialect, demo flag, auth scheme, token lifetime) |
| `dashboard.py` | `/dashboard/summary` | metrics, disruption summaries, critical orders, timeline, next actions, recent decisions; `order_risk_map()` computes each open order's worst outcome across active disruptions and is reused by orders/customers |
| `disruptions.py` | `/disruptions` | GET list (computed impact + adopted plan), POST report (severity computed by `classify_severity`), GET `/decisions` log, GET `/{id}` full detail, PATCH `/{id}/status`, GET/POST `/{id}/decisions` (adopt: re-runs the engine with the given inputs and stores the chosen outcome, superseding earlier decisions, marking the disruption mitigated unless baseline) |
| `scenarios.py` | `/scenarios` | GET strategies, POST simulate (the War Room endpoint) |
| `orders.py` | `/orders` | GET list with risk, GET one, PATCH `/{id}/status` |
| `inventory.py` | `/inventory` | GET (sorted critical → low → healthy), GET one, PATCH (rejects negatives) |
| `materials.py` | `/materials` | GET list, POST create (also creates its inventory row), GET one |
| `suppliers.py` | `/suppliers` | GET list/detail with shipment counts, POST create, GET `/{id}/shipments` |
| `customers.py` | `/customers` | GET list/detail with orders, risk and penalty exposure, POST create |

`api/__init__.py` assembles `api_router` in that order.

### 3.9 Demo data — `backend/app/db/seed.py`

Creates two users, six suppliers, seven materials (two with qualified alternate suppliers), inventory rows, four customers (tiers, SLA rates, priorities), eight production orders with 26 BOM lines, and four shipment delays (critical, high, mitigated, resolved). Dates are relative to *today* so the demo always looks current. It also stores one historical decision computed by the engine for the mitigated disruption. `python -m app.db.seed --reset` rebuilds everything.

### 3.10 Tests — `backend/tests/`

`conftest.py` points the app at an isolated SQLite file, resets and seeds it through the real startup path, and provides a logged-in `auth_headers` fixture.

| File | Covers |
|---|---|
| `test_health.py` | health body, security headers, root, production config validation |
| `test_auth.py` | register/login/me, validation, profile update, password change, every protected route returns 401 without a token |
| `test_core_entities.py` | suppliers (detail, shipments, create, duplicates), materials, inventory status and patch validation, customers, orders with risk, system info |
| `test_disruptions_and_engine.py` | list impact, detail, status update, strategy listing, default assumptions (exact expected numbers), custom assumptions, edge cases (zero delay, clamping, 404/422), dashboard summary, reallocation donor logic |
| `test_workflows.py` | seeded decision log, adopt + supersede, report disruption with computed severity, order status update |

Run with `python -m pytest -q` from `backend/` (26 tests).

---

## 4. Frontend

### 4.1 Entry and routing — `src/main.tsx`, `src/App.tsx`

`main.tsx` mounts `ErrorBoundary → BrowserRouter → ToastProvider → AuthProvider → App`. `App.tsx` declares routes: `/login` and `/register` (redirect away when already signed in), then a `RequireAuth` layout route wrapping `AppShell`, under which every screen lives (`/`, `/disruptions`, `/disruptions/:id`, `/war-room`, `/war-room/:id`, `/orders/:id?`, `/inventory`, `/suppliers/:id?`, `/customers/:id?`, `/settings`, `*`).

### 4.2 Auth — `src/context/AuthContext.tsx`, `src/components/layout/RequireAuth.tsx`

- The token lives in `localStorage` under `supplyguard_token`.
- On load, if a token exists the provider calls `/auth/me`; failure clears the token.
- `login` / `register` store the token and user; `logout` clears both.
- The API client is given an **unauthorized handler**: any 401 from a protected call logs the user out, so an expired token never leaves the UI in a broken state.
- `RequireAuth` shows a restoring-session screen while loading and redirects to `/login` (remembering the requested path) when signed out.

### 4.3 API client — `src/services/api.ts`

A single `request<T>()` helper: builds the URL from `VITE_API_BASE_URL` (empty in development, where Vite proxies `/api`), adds the bearer token, turns FastAPI error bodies (including 422 validation arrays) into readable `ApiError` messages, and maps network failures to a clear "cannot reach the API" message. The exported `api` object has one typed function per endpoint. Types live in `src/types/api.ts` and mirror the backend schemas.

### 4.4 Shared hooks and utilities

- `src/hooks/useFetch.ts`: loading / error / data state with `reload(silent)` and `setData` for optimistic updates; ignores stale responses.
- `src/lib/format.ts`: money, number, percent, date, relative-day and title-case helpers.
- `src/lib/csv.ts`: builds the War Room CSV (comparison table, assumptions, per-order outcomes) and triggers a download.

### 4.5 Design system — `src/components/ui/`

| Component | Role |
|---|---|
| `Button` | variants primary / secondary / danger / ghost / outline, loading state, icons |
| `Badge` | status chips; `riskTone()` and `statusTone()` map domain values to tones; icons so colour is never the only signal |
| `Card`, `StatCard`, `KeyValueList`, `PageHeader` | layout primitives |
| `Table` | generic sortable table with keyboard-activatable rows and empty state |
| `Inputs` | `Field`, `Input`, `Select`, `SearchInput`, `Toggle` with validation styling |
| `Modal`, `ConfirmDialog` | accessible dialogs (Escape closes, focus restored) |
| `States` | `Spinner`, `Skeleton`, `LoadingBlock`, `EmptyState`, `ErrorState`, and `DataState` which renders loading / error / empty / content |
| `Alert` | inline notices |

Styling is Tailwind; tokens live in `tailwind.config.js` (navy shell palette, Inter font, card shadow) and `src/index.css` (base, focus ring, slider, scroll containers, animations).

### 4.6 Application shell — `src/components/layout/`

- `AppShell.tsx`: fixed-to-viewport layout; the `<main>` region is the **only scroll container** (fixes endless-scroll in embedded browsers). Sets `document.title` per route, scrolls to top on navigation, loads the dashboard summary every 60 s to feed the sidebar badge and the notification bell, shows the demo-data banner and a footer.
- `Sidebar.tsx`: navigation with active indicator, active-disruption count, user card and sign-out; slides in as a drawer on mobile.
- `TopBar.tsx`: page title, **global search** (lazily builds an index from orders, disruptions, suppliers, customers, inventory and filters it client-side), API status pill (pings `/health` every 15 s with latency), notifications menu (the dashboard's next actions), profile menu.

### 4.7 Pages — `src/pages/`

| Page | Data | Notable behaviour |
|---|---|---|
| `LoginPage` | `/auth/login` | demo account quick-fill (hideable via env), validation, remembers where you were going; exports `AuthLayout` reused by Register |
| `RegisterPage` | `/auth/register` | full validation incl. password confirmation |
| `DashboardPage` | `/dashboard/summary` | headline disruption, six `StatCard`s, next actions, `Timeline`, `ExposureByDisruptionChart`, recent `DecisionLog`, orders table, disruptions table |
| `DisruptionsPage` | `/disruptions` | search, status and risk filters, sortable table, `ReportDisruptionModal` |
| `DisruptionDetailPage` | `/disruptions/{id}` | KPI strip, shipment/supplier, inventory with the shortage calculation shown, financial impact, affected orders, commitments grouped by customer, decision log, status change with confirmation, link to War Room |
| `WarRoomPage` | `/scenarios/simulate`, `/disruptions/{id}/decisions` | picker when no id; delay slider and quick-set buttons; `AssumptionsPanel`; auto-rerun (debounced 250 ms, stale responses ignored); strategy cards; `ExposureChart` and `DeliveryChart`; side-by-side table; `DecisionSummary`; adopt dialog with note; decision log; CSV export |
| `OrdersPage` | `/orders` | search/filters, BOM chips showing shortfalls, detail modal with full BOM and status change |
| `InventoryPage` | `/inventory` | status tiles that filter, table, adjust modal with validation and optimistic update |
| `SuppliersPage` / `CustomersPage` | `/suppliers`, `/customers` | tables, detail modals, add forms (`PartnerFormModals`) |
| `SettingsPage` | `/auth/me`, `/system/info` | profile name edit, password change, API/DB connection info and test, sign-out |
| `NotFoundPage` | — | 404 |

### 4.8 War Room components — `src/components/warroom/`

- `AssumptionsPanel.tsx`: seven numeric inputs grouped by strategy; empty = backend default (shown as placeholder and "using N"); custom values highlighted; reset button.
- `ComparisonCharts.tsx`: Recharts. `ExposureChart` stacks added cost and remaining penalties per strategy with a baseline reference line and a "Recommended" label; `DeliveryChart` groups remaining delay, late orders and protected commitments. Clicking a bar selects that strategy.
- `DecisionSummary.tsx`: what the strategy does, why it helps, cost, delivery impact, penalties avoided, net benefit, remaining risks, and an order-by-order table (affected and donor orders).
- `DecisionLog.tsx`: list of adopted / superseded decisions with author, time, cost, avoided, net and note.

### 4.9 Dashboard components — `src/components/dashboard/`

`Timeline.tsx` renders the merged timeline of original/revised ETAs, order due dates and projected finishes; `ExposureChart.tsx` is the horizontal exposure-by-disruption bar.

### 4.10 Forms — `src/components/forms/`

`ReportDisruptionModal.tsx` loads suppliers and materials, validates dates and quantities, posts the disruption and navigates to the new detail page. `PartnerFormModals.tsx` holds the add-supplier and add-customer forms.

---

## 5. Where things live when you need to change them

| Change | Touch |
|---|---|
| A new recovery strategy | `engine.py`: `STRATEGY_KEYS`, `STRATEGY_META`, a branch in `evaluate_strategy`, `_explain`; frontend `types/api.ts` `StrategyKey`, `ComparisonCharts.tsx` `SHORT` labels, `WarRoomPage.tsx` `STRATEGY_ORDER` |
| A new assumption | `engine.py` `Assumptions`, `schemas/scenario.py` `ScenarioAssumptionsIn`, `AssumptionsPanel.tsx` `FIELDS`, `types/api.ts` |
| A new dashboard metric | `schemas/dashboard.py`, `api/dashboard.py`, `DashboardPage.tsx` |
| A new entity | model in `models/`, schema in `schemas/`, router in `api/`, register in `api/__init__.py`, seed rows, API client function, type, page |
| Branding | `tailwind.config.js`, `index.css`, `Sidebar.tsx`, `index.html` |

---

## 6. Questions judges ask, and the answers in the code

- **Is any number made up?** No. Dashboard, detail and War Room figures all come from `engine.py` reading the database. Explanations are templates filled from results (`_explain`). Tests assert exact expected values from the seed data.
- **How does it decide which order gets scarce stock?** Customer priority score, then committed date (`_priority_key`).
- **Why can reallocation help?** Orders that start after the delayed shipment arrives do not need their reserved units yet; releasing them (donors) unblocks higher-priority orders now.
- **What if the alternate supplier is slower than the revised ETA?** The engine still evaluates it and flags the risk text "adds cost without recovering time"; it will not be recommended.
- **Is authentication real?** Yes: bcrypt hashes, signed JWTs, protected routes, 401 handling, password change verified server-side.
- **Does it persist?** PostgreSQL in production, SQLite locally. Reported disruptions, adopted decisions, order and inventory changes are all database writes.
- **Can it run on real data?** The schema is a normal ERP shape (suppliers, materials, inventory, customers, orders, BOM lines, shipments). Load those tables and the engine works unchanged.
