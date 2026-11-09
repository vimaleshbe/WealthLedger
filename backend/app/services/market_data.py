from datetime import UTC, datetime, timedelta

import httpx
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.models import Asset, MarketDataCache

STALENESS_HOURS = 24


class FetchError(Exception):
    pass


def _is_stale(fetched_at: datetime) -> bool:
    return datetime.now(UTC) - fetched_at > timedelta(hours=STALENESS_HOURS)


def fetch_yahoo_finance(symbol: str) -> tuple[float, str]:
    """Fetch latest close price from Yahoo Finance."""
    ticker = symbol.upper()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    response = httpx.get(url, headers=headers, timeout=30.0)
    if response.status_code != 200:
        raise FetchError(f"Yahoo Finance returned {response.status_code}")
    payload = response.json()
    result = payload["chart"]["result"]
    if not result:
        raise FetchError("No chart result from Yahoo Finance")
    price = result[0]["meta"]["regularMarketPrice"]
    if price is None:
        raise FetchError("No market price available")
    return float(price), "yahoo_finance"


def fetch_mfapi(scheme_code: str) -> tuple[float, str]:
    """Fetch latest NAV from MFAPI.in."""
    url = f"https://api.mfapi.in/mf/{scheme_code}"
    response = httpx.get(url, timeout=30.0)
    if response.status_code != 200:
        raise FetchError(f"MFAPI returned {response.status_code}")
    payload = response.json()
    nav = payload["data"][0]["nav"]
    return float(nav), "mfapi"


def fetch_market_price(asset_type: AssetType, symbol: str) -> tuple[float, str]:
    if asset_type in (AssetType.STOCK, AssetType.PHYSICAL_GOLD):
        return fetch_yahoo_finance(symbol)
    if asset_type == AssetType.MUTUAL_FUND:
        return fetch_mfapi(symbol)
    raise FetchError(f"Unsupported asset type for market data: {asset_type}")


def sync_asset_price(session: Session, asset: Asset) -> MarketDataCache | None:
    if not asset.symbol:
        return None
    try:
        price, source = fetch_market_price(asset.asset_type, asset.symbol)
    except FetchError:
        return None

    cache = session.exec(
        select(MarketDataCache).where(
            MarketDataCache.asset_type == asset.asset_type,
            MarketDataCache.symbol == asset.symbol,
        )
    ).first()
    if cache:
        cache.price = price
        cache.fetched_at = datetime.now(UTC)
        cache.source = source
    else:
        cache = MarketDataCache(
            asset_type=asset.asset_type,
            symbol=asset.symbol,
            price=price,
            source=source,
        )
        session.add(cache)
    session.commit()
    session.refresh(cache)
    return cache


def get_stale_assets(session: Session) -> list[MarketDataCache]:
    caches = session.exec(select(MarketDataCache)).all()
    return [cache for cache in caches if _is_stale(cache.fetched_at)]
