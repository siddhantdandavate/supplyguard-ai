# SupplyGuard AI — Production Rescue Planner

> When a supplier shipment slips, SupplyGuard tells a manufacturer **what is short, which orders and customers it hurts, what it will cost, and which recovery plan to pick** — in minutes instead of a day of spreadsheets.

- **Run locally:** frontend http://localhost:5173 · API docs http://127.0.0.1:8000/docs
- **Demo logins:** `planner@supplyguard.io` / `password123` · `admin@supplyguard.io` / `admin123`
- **Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Recharts · FastAPI · SQLAlchemy · PostgreSQL (SQLite fallback) · JWT
- **Docs:** [Code walkthrough](docs/CODE_WALKTHROUGH.md) (also as [Word document](docs/CODE_WALKTHROUGH.docx)) explains every module for anyone presenting or extending the code.

---

## 1. The problem

Small and medium-sized manufacturers build to customer commitments with thin inventory buffers. A single late shipment of one component starts a chain reaction:

1. **Nobody knows the real shortage.** Stock on hand, stock already reserved for other orders and the quantity still in transit live in different sheets. The planner reconciles them by hand.
2. **Nobody knows which orders break.** A material shortage ripples into work orders, then into customer delivery dates, then into contractual SLA penalties. Tracing that chain manually is slow and error-prone.
3. **Recovery decisions are made on gut feel.** Expedite the freight? Buy from a second source at a premium? Pull stock from a lower-priority order? Each option has a cost and a delivery outcome, but there is no quick way to compare them side by side.
4. **Decisions are not recorded.** Once a plan is chosen, the reasoning disappears into email, so the same analysis is redone the next time.

The cost of getting this wrong is concrete: late-delivery penalties, lost revenue on strategic accounts, premium freight spent where it did not help, and production lines starved of parts.

## 2. Our core idea

Treat a disruption as a **computable event**, not a fire drill.

Given one fact — *shipment X of material Y now arrives N days late* — SupplyGuard deterministically derives everything a planner needs:

| Question the planner asks | How SupplyGuard answers it |
|---|---|
| How short are we? | Unfilled demand across open orders minus free stock, allocated by customer priority |
| Which orders and customers are affected? | Every order that needs the material and is not fully allocated, with its projected finish date |
| How bad is it financially? | Late days × each customer's SLA penalty rate, plus revenue on late orders |
| What are my options? | Five recovery strategies evaluated with the same engine and the same data |
| Which one should I choose? | The one with the lowest **total exposure = added cost + remaining penalties** |
| What risk is left? | Orders still late, units still uncovered, operational caveats per strategy |

The signature feature is the **What-If War Room**: an interactive scenario planner where the planner changes the delay and the assumptions behind each strategy and watches cost, delivery dates, late orders and penalties recompute instantly.

## 3. What we solve

- **Shortage calculation** from live inventory and bill-of-materials data, not estimates.
- **Impact tracing** from material → production order → customer commitment → SLA penalty → revenue at risk.
- **Strategy comparison** across Baseline, Expedited shipment, Alternate supplier, Inventory reallocation and a Combined plan, with cost-versus-delivery charts and a side-by-side table.
- **Explainable recommendation**: every number is computed by documented rules, and the explanation is generated from those numbers. No AI-invented values.
- **Decision log**: adopted plans are stored with who chose them, the inputs used, the expected outcome and a note. Adopting again supersedes the previous decision.
- **Operational control**: report new disruptions, change order status, adjust stock, add suppliers and customers — every change flows straight into the risk figures.

## 4. Product tour

| Screen | What it does |
|---|---|
| **Control Center** | Answers *what is wrong, how severe, which orders, what next*: headline disruption, six KPI tiles, ranked next actions, disruption timeline, exposure chart, orders needing attention, recent decisions |
| **Disruptions** | Searchable, filterable, sortable list with computed affected orders and penalty exposure; **Report disruption** form (severity is computed on save) |
| **Disruption detail** | Shipment and supplier facts, inventory position, the shortage calculation shown step by step, affected orders with projected finish dates, customer commitments at risk, decision history |
| **What-If War Room** | Delay slider, adjustable assumptions, five strategy cards, cost-vs-penalty and delivery-impact charts, side-by-side comparison, decision summary with remaining risks, adopt plan, CSV export |
| **Production Orders** | Orders with BOM allocation, computed risk level, late days and penalty; status changes |
| **Inventory** | Stock, reserved, available, reorder points, status (healthy / low / critical); inline adjustment |
| **Suppliers / Customers** | Lead times, reliability, shipment history; tiers, SLA terms, commitments at risk; add new records |
| **Settings** | Profile, password change, API and database connection details |

## 5. End-to-end demo flow (3 minutes)

1. **Sign in** as the planner.
2. The **Control Center** shows PO-9914 (optical encoders) 14 days late: 3 orders will miss commitments, **$30,600** of SLA penalties and **$550,000** of revenue at risk.
3. **Review impact**: free stock is 0, unfilled demand is 60 units, three customers are affected.
4. **Open the War Room**. The engine recommends the **Combined plan**: $2,780 of expedite and handling cost avoids $28,200 of penalties and protects two of three commitments.
5. Drag the delay to 28 days or change *days recovered by expediting*: every card, chart and the recommendation recompute.
6. **Adopt the plan** with a note. The disruption is marked mitigated, the decision appears in the log and on the dashboard, and the dashboard's exposure drops.

## 6. How the engine works

For a delayed shipment of a material:

1. Every open order's **unfilled** demand is `required − allocated`.
2. Free stock (`current − reserved`) is allocated to unfilled demand by customer priority score, then committed date.
3. Remaining demand waits for **supply events**. Baseline supply is the shipment arriving at `original ETA + delay days`.
4. An order's projected completion is `cover date + remaining build days`; `late days = projected − committed`; `SLA penalty = late days × customer penalty per day`.

| Strategy | Effect | Cost |
|---|---|---|
| Baseline | nothing changes | 0 |
| Expedited shipment | shipment arrives `expedite_days_saved` earlier (default 60 % of the delay) | fixed fee + per-unit surcharge (default 35 % of unit cost, min $1.50) |
| Alternate supplier | uncovered units arrive after the qualified secondary supplier's lead time | units × unit cost × price premium (default 25 %) |
| Inventory reallocation | stock reserved for orders whose deadlines can absorb the delay is released to orders that cannot | handling cost per unit moved |
| Combined | expedite + reallocation | sum of both |

**Recommendation rule:** lowest total exposure (added cost + remaining penalties), tie-broken by fewer late orders, then lower cost. All assumptions are adjustable in the War Room and documented in `backend/app/services/engine.py`.

## 7. Architecture

```
Browser (React SPA, Netlify)  ──HTTPS──▶  FastAPI (Render / Docker)  ──SQLAlchemy──▶  PostgreSQL
   React Router, Tailwind, Recharts        JWT auth, Pydantic schemas,                 (SQLite fallback
   fetch client with bearer token          deterministic recovery engine               for local dev)
```

- **Backend** `backend/app`: `api/` routers · `core/` config, database, security · `models/` SQLAlchemy · `schemas/` Pydantic · `services/engine.py` calculation engine · `db/seed.py` demonstration data · `tests/` pytest suite (26 tests).
- **Frontend** `frontend/src`: `pages/` one file per screen · `components/ui` design system · `components/layout` shell · `components/warroom` charts, assumptions, decision summary · `services/api.ts` typed client · `context/` auth and toasts.

Security: bcrypt password hashing, HS256 JWT with 24 h lifetime, every data route requires a bearer token, security headers on every response, production refuses to boot without a real secret and explicit CORS origins.

## 8. Run locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell   (cmd: .venv\Scripts\activate.bat, macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # optional; edit SECRET_KEY and DATABASE_URL
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

First start creates the schema and seeds demonstration data. If PostgreSQL at `DATABASE_URL` is unreachable the app logs a warning and uses `backend/supplyguard.db` (SQLite).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to port 8000. For a backend on another port:

```bash
set VITE_API_TARGET=http://127.0.0.1:8001 && npm run dev -- --port 5174     # Windows cmd
```

### Rebuild the demo data

Seeded dates are relative to the day the database was created. To refresh:

```bash
cd backend && .venv\Scripts\python.exe -m app.db.seed --reset
```

### Tests and build

```bash
cd backend && .venv\Scripts\python.exe -m pytest -q      # 26 tests: auth, APIs, engine, workflows
cd frontend && npm run build                               # type-check + production bundle
```

## 9. Deploying

The frontend is a static site (Netlify); the API runs on any Python host (Render blueprint included, or the Dockerfile).

**API on Render:** New → Blueprint → pick the repo. `render.yaml` creates the `supplyguard-api` service and a PostgreSQL database. Set `CORS_ORIGINS` to your Netlify URL; `SECRET_KEY` is generated. Health check: `/api/health`.

**Frontend on Netlify:** Add new site → Import from GitHub. `netlify.toml` provides the base directory, build command, SPA redirect and security headers. Add `VITE_API_BASE_URL` = your API origin without `/api`. Optionally `VITE_SHOW_DEMO_ACCOUNTS=false`.

Production checklist: `ENVIRONMENT=production`, `SECRET_KEY` (32+ random chars), `DATABASE_URL`, `CORS_ORIGINS`, `ALLOW_SQLITE_FALLBACK=false`, `ENABLE_DOCS=false` unless wanted. CI (`.github/workflows/ci.yml`) runs tests and the build on every push.

## 10. Environment variables

See `backend/.env.example` and `frontend/.env.example`. `.env` files are ignored by git.

## 11. Limitations and roadmap

- Single-material disruptions: a shipment carries one material. Multi-line shipments would extend `ShipmentDelay` to lines.
- Build-time model: remaining build days are derived from planned dates; capacity and shift calendars are not modelled.
- Roles are informational; an admin endpoint for role management is the next auth step.
- Demonstration data is fictional; connect an ERP/MRP export to the same tables to run on real data.
- Natural-language explanations are deterministic templates; an LLM layer could rephrase them but must never change the numbers.
