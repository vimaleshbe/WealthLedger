---
name: Portfolio Deployment
description: Use when changing the Dockerfile, Docker Compose, production build, or deploying the portfolio tracker.
---

# Portfolio Deployment

## Architecture

Deployment is **one container**: the root `Dockerfile` builds the React frontend, copies `dist/` into the FastAPI image as `app/static`, and FastAPI serves the UI and API on port `8000`. No nginx.

`backend/app/main.py` uses `SPAStaticFiles` so client routes like `/assets/12` return `index.html`.

## Commands

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
docker compose down
```

Open `http://localhost:8000`.

## Compose

- One service: `app`
- `DATABASE_URL=sqlite:////app/data/app.db`
- `ENVIRONMENT=production`
- bind mount: `./backend/data:/app/data`
- healthcheck on `/health`
- `restart: unless-stopped`

The bind mount uses the live database directly. Read `portfolio-data` before changing it.

## Verify a deploy

```bash
docker compose ps                                  # healthy
curl http://localhost:8000/health
curl http://localhost:8000/
curl http://localhost:8000/transactions
curl http://localhost:8000/assets/1
curl http://localhost:8000/api/v1/dashboard/summary
curl http://localhost:8000/api/v1/assets
```

Confirm:

- UI HTML is served
- deep links return HTML, not 404
- API returns the expected asset count
- data is unchanged after `docker compose restart app`

## Quirks

- SQLite absolute URLs need four slashes: `sqlite:////app/data/app.db`.
- The container runs as non-root `appuser`; the bind mount must stay writable.
- On Windows, start Docker Desktop first. `docker compose config` works without the daemon; builds do not.
- Keep the root build context small via `.dockerignore` (exclude `.venv`, `node_modules`, `dist`, `app/static`, databases, caches).
- Do not add per-service Dockerfiles or nginx. Production is a single container.
