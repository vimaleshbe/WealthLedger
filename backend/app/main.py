import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import assets, auth, cash, dashboard, entries, search, sync
from app.core.config import settings
from app.core.middleware import SecurityMiddleware
from app.core.security import validate_auth_config
from app.db import engine, init_db
from app.models import Asset
from app.services.market_data import sync_asset_price

scheduler = BackgroundScheduler()


def _daily_sync() -> None:
    with Session(engine) as session:
        for asset in session.exec(select(Asset)).all():
            sync_asset_price(session, asset)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()
    init_db()
    scheduler.add_job(_daily_sync, "cron", hour=9, minute=0)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="WealthLedger",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Order matters: CORS must wrap the security middleware so preflight
# requests are answered before authentication is checked.
app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(entries.router, prefix="/api/v1")
app.include_router(cash.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")


class SPAStaticFiles(StaticFiles):
    """Serve index.html for client-side routes while keeping asset 404s."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api"):
                return await super().get_response("index.html", scope)
            raise


static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="static")
