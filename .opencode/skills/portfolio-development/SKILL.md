---
name: Portfolio Development
description: Use when changing the portfolio tracker backend, React UI, API, dashboard, assets, entries, sync, or search.
---

# Portfolio Development

## Stack

- Backend: Python 3.12, FastAPI, SQLModel, SQLite (`backend/`)
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Recharts, TanStack Query (`frontend/`)
- API prefix: `/api/v1`. Health: `/health`.

For database or test-data changes, also load `portfolio-data`.

## Layout

```text
backend/app/
├── main.py          # app, routers, SPA static fallback
├── models.py        # SQLModel tables
├── schemas.py       # API schemas
├── db.py            # engine/session
├── api/             # assets, entries, dashboard, sync, search
├── core/config.py   # settings
└── services/        # market_data, xirr, snapshots

frontend/src/
├── api/             # fetch client + React Query hooks
├── components/      # UI primitives, charts, forms, skeletons
├── pages/           # Dashboard, AssetList, AssetFormPage, AssetView, Transactions
├── lib/utils.ts     # currency/date/relative-time helpers
├── App.tsx          # fixed header, lazy routes, progress bar, error boundary
└── index.css        # theme tokens, background, animations
```

## Commands

```bash
# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check . && uv run ruff format --check .

# Frontend
cd frontend
npm install
npm run dev
npm run build        # REQUIRED validation (tsc + vite)
```

- `npm run lint` fails because there is no `eslint.config.js`; use `npm run build`.
- Run only one Vite dev server at a time.
- Vite proxies `/api` to `http://localhost:8000`; override with `VITE_API_PROXY_TARGET`.

## Domain rules

- **Total Portfolio** = stocks + mutual funds + PPF.
- **Net Worth** = all assets.
- **XIRR** uses stocks + mutual funds + physical gold + PPF. Each entry is an outflow on its date; current market/NAV value is the inflow today. Gold is valued at the latest 22K/24K rate per gram. Scopes: portfolio, equity (non-gold funds), and gold (physical gold + gold ETFs/funds).
- **CAGR** annualizes current market value against net invested capital from the first purchase in each scope. Holdings of one year or less show **absolute return** instead of annualizing a short period.
- Entry history is accumulated (`date`, `value`, `units`).
- Stock search uses Yahoo Finance; mutual fund search uses MFAPI.in.
- Sync is triggered by the header `SyncButton`; a scheduler also runs daily at 09:00.
- Transactions are newest first.

## Frontend conventions

- Fixed header (`fixed inset-x-0 top-0 z-50`); main content uses `pt-24`.
- Keep lazy routes, `Suspense`, `RouteProgress`, page-in animation, and skeletons.
- Reuse `components/ui/` and `cn()` from `lib/utils.ts`; reuse currency/date helpers.
- Recharts must keep `isAnimationActive={false}` — animations caused blank charts in headless rendering.
- Assets page: floating `+` opens the Add modal; Edit edits asset details only; View manages entry history.
- Preserve existing dates when editing; validate entry date and value.
- Theme: indigo/emerald, Inter, emerald gains, rose losses.

## Checklist

1. Read related files and match existing patterns.
2. Run `uv run ruff check .` for backend changes.
3. Run `npm run build` for frontend changes.
4. Verify through the single production server, not only the Vite dev server.
5. Do not keep `frontend/dist`, `backend/app/static`, `*.tsbuildinfo`, `__pycache__`, `.pytest_cache`, or `.ruff_cache`.
6. Do not reintroduce spec-kit/specify files.
