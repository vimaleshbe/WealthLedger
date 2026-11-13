from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import MarketDataCache
from app.services.market_data import get_stale_assets, sync_all_market_data
from app.services.xirr_history import record_xirr_snapshot

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/market-data", status_code=202)
def trigger_sync(session: Session = Depends(get_session)) -> dict[str, Any]:
    sync_all_market_data(session)
    record_xirr_snapshot(session)
    return {
        "status": "started",
        "started_at": datetime.now(UTC).isoformat(),
    }


@router.get("/market-data/status")
def sync_status(session: Session = Depends(get_session)) -> dict[str, Any]:
    latest = session.exec(
        select(MarketDataCache).order_by(MarketDataCache.fetched_at.desc())
    ).first()
    stale = get_stale_assets(session)
    return {
        "last_sync_at": latest.fetched_at.isoformat() if latest else None,
        "next_sync_at": None,
        "stale_assets": [
            {
                "asset_id": None,
                "symbol": cache.symbol,
                "last_price": cache.price,
                "fetched_at": cache.fetched_at.isoformat(),
            }
            for cache in stale
        ],
    }
