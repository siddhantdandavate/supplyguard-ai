# SupplyGuard AI — Production Rescue Planner

SupplyGuard AI helps small and medium-sized manufacturers respond to supplier shipment disruptions. It calculates material shortages from a late shipment, traces the production orders and customer commitments the shortage puts at risk, and compares recovery strategies side by side in the **What-If War Room**.

All data shown by default is **seeded demonstration data** for a fictional robotics/automation manufacturer. The dashboard, disruption impact figures and War Room results are computed from that data by a deterministic calculation engine; nothing is hardcoded in the UI.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, React Router |
| Backend  | Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2, Pydantic 2, PyJWT, bcrypt |
| Database | PostgreSQL (primary, via `DATABASE_URL`) with automatic SQLite fallback for local development |

## Project layout

```
supplyapp/
├── backend/
│   ├── app/
│   │   ├── api/          # routers: auth, dashboard, disruptions, scenarios, orders, inventory, materials, suppliers, customers, system, health
│   │   ├── core/         # config, database engine (Postgres → SQLite fallback), JWT + bcrypt security
│   │   ├── db/seed.py    # demonstration data (python -m app.db.seed --reset to rebuild)
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/engine.py  # recovery calculation engine (documented assumptions)
│   ├── tests/            # pytest suite (isolated SQLite database)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── components/   # ui kit, layout shell, dashboard timeline, War Room charts
        ├── pages/        # Login, Register, Dashboard, Disruptions, Disruption detail, War Room, Orders, Inventory, Suppliers, Customers, Settings
        ├── context/      # auth (JWT persistence) and toasts
        ├── services/api.ts
        └── types/api.ts
```

## Prerequisites

- Node.js 18+ (tested with Node 24)
- Python 3.10+ (tested with Python 3.12)
- Optional: PostgreSQL 14+ if you want the primary database instead of the SQLite fallback

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell   (cmd: .venv\Scripts\activate.bat, macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # optional; edit SECRET_KEY and DATABASE_URL
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On first start the backend creates the schema and seeds demonstration data. If PostgreSQL at `DATABASE_URL` is unreachable it logs a warning and uses `backend/supplyguard.db` (SQLite).

- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health → `{"status":"ok"}`

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend on port 8000. To point at a backend on another port:

```bash
set VITE_API_TARGET=http://127.0.0.1:8001 && npm run dev -- --port 5174     # Windows cmd
```

Production build: `npm run build` (output in `frontend/dist`, preview with `npm run preview`).

### Demo accounts

| Role    | Email                     | Password     |
|---------|---------------------------|--------------|
| Planner | planner@supplyguard.io    | password123  |
| Admin   | admin@supplyguard.io      | admin123     |

You can also register a new account from the login page.

### Rebuild the demo data

Seeded dates are relative to the day the database was created. To refresh them:

```bash
cd backend && .venv\Scripts\python.exe -m app.db.seed --reset
```

or start the backend once with `RESET_DEMO_DATA=true`.

## Tests

```bash
cd backend && .venv\Scripts\python.exe -m pytest -q
```

The suite uses its own SQLite file under `backend/tests/` and covers health, authentication (register, login, profile update, password change, protected routes), every entity API, disruption impact, the dashboard summary, and the recovery engine (default assumptions, custom assumptions, edge cases).

## What you can do in the app

- **Report a disruption** (Disruptions → Report disruption): severity, affected orders and the recommended plan are computed on save.
- **Plan recovery** in the What-If War Room: adjust the delay and seven strategy assumptions, compare five strategies on cost versus delivery, export the comparison as CSV.
- **Adopt a plan**: the chosen strategy, its inputs and expected outcome are stored in the decision log with who adopted it and an optional note; adopting again supersedes the previous decision. Decisions appear on the dashboard and the disruption page.
- **Run operations**: change order status, adjust stock counts and reorder points, add suppliers and customers. Every change flows straight into shortage and risk figures.
- **Manage your account**: update your display name, change your password, inspect the API and database connection.

## How the engine works

For a delayed shipment of a material:

1. Every open order's **unfilled** demand is `required − allocated`.
2. Free stock (`current − reserved`) is allocated to unfilled demand by customer priority, then committed date.
3. Remaining demand waits for **supply events**. Baseline supply is the shipment arriving at `original ETA + delay days`.
4. An order's projected completion is `cover date + remaining build days`; late days drive `SLA penalty = late days × customer penalty/day`.

Strategies change supply and stock:

| Strategy | Effect | Cost |
|----------|--------|------|
| Baseline | none | 0 |
| Expedited shipment | shipment arrives `expedite_days_saved` earlier (default 60 % of the delay) | fixed fee + per-unit surcharge (default 35 % of unit cost, min $1.50) |
| Alternate supplier | uncovered units arrive after the qualified secondary supplier's lead time | units × unit cost × price premium (default 25 %) |
| Inventory reallocation | stock reserved for orders that can absorb the delay without becoming late is released to orders that cannot | handling cost per unit moved |
| Combined | expedite + reallocation | sum of both |

The recommended strategy minimises **total exposure = added cost + remaining penalties**. All assumptions can be adjusted in the War Room; every change re-runs the engine.

## Deploying

The frontend is a static site (Netlify); the API runs anywhere that serves Python (Render blueprint included, or the Dockerfile).

### 1. API on Render (free tier)

1. Push this repository to GitHub.
2. In Render choose **New → Blueprint**, pick the repo; `render.yaml` creates the `supplyguard-api` web service and a managed PostgreSQL database.
3. Set `CORS_ORIGINS` on the service to your Netlify URL (for example `https://supplyguard.netlify.app`). `SECRET_KEY` is generated for you.
4. Wait for the health check at `/api/health` to pass. The first boot seeds the demonstration data.

Any other host works with the `backend/Dockerfile` or `backend/Procfile`. Required production variables: `ENVIRONMENT=production`, `SECRET_KEY` (32+ random chars), `DATABASE_URL`, `CORS_ORIGINS`. The app refuses to start in production without them.

### 2. Frontend on Netlify

1. In Netlify choose **Add new site → Import an existing project**, pick the repo. `netlify.toml` sets the base directory (`frontend`), build command and publish directory, plus the SPA redirect and security headers.
2. Add the environment variable `VITE_API_BASE_URL` = your API origin **without** `/api` (for example `https://supplyguard-api.onrender.com`).
3. Optionally set `VITE_SHOW_DEMO_ACCOUNTS=false` to hide the demo credential buttons.
4. Deploy. Open the site, sign in with a demo account, and confirm the API status pill in the top bar shows **API online**.

Netlify CLI alternative from `frontend/`: `npm run build` then `netlify deploy --prod --dir=dist`.

### Production checklist

- `SECRET_KEY` set and not the development default; `ENVIRONMENT=production`.
- `CORS_ORIGINS` contains only your frontend origin(s).
- `ALLOW_SQLITE_FALLBACK=false` so a database outage fails loudly instead of silently using SQLite.
- `ENABLE_DOCS=false` unless you want public API docs.
- Continuous integration (`.github/workflows/ci.yml`) runs the backend tests and the frontend build on every push.

## Environment variables

See `backend/.env.example`. `SECRET_KEY` must be set to a long random value outside local development. `.env` files are ignored by git.
