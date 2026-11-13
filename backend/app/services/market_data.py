from datetime import UTC, date, datetime, timedelta

import httpx
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.core.gold import purity_from_asset
from app.models import Asset, MarketDataCache
from app.services.gold_rates import (
    GoldRateError,
    get_cached_gold_rate,
    sync_gold_rates,
)

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


def fetch_mfapi_history(scheme_code: str) -> dict[str, float]:
    """Fetch the full NAV history for a mutual fund scheme."""
    url = f"https://api.mfapi.in/mf/{scheme_code}"
    response = httpx.get(url, timeout=15.0)
    if response.status_code != 200:
        raise FetchError(f"MFAPI returned {response.status_code}")

    prices: dict[str, float] = {}
    for item in response.json().get("data", []):
        try:
            day = datetime.strptime(item["date"], "%d-%m-%Y").date().isoformat()
            prices[day] = float(item["nav"])
        except (KeyError, TypeError, ValueError):
            continue
    return prices


def fetch_yahoo_history(symbol: str, start: date, end: date) -> dict[str, float]:
    """Fetch daily closing prices for a stock from Yahoo Finance."""
    ticker = symbol.upper()
    period1 = int(
        datetime(start.year, start.month, start.day, tzinfo=UTC).timestamp()
    ) - int(timedelta(days=7).total_seconds())
    period2 = int(datetime(end.year, end.month, end.day, tzinfo=UTC).timestamp()) + int(
        timedelta(days=1).total_seconds()
    )
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    response = httpx.get(
        url,
        params={
            "period1": period1,
            "period2": period2,
            "interval": "1d",
            "events": "history",
        },
        headers=headers,
        timeout=15.0,
    )
    if response.status_code != 200:
        raise FetchError(f"Yahoo Finance returned {response.status_code}")

    result = response.json()["chart"]["result"]
    if not result:
        raise FetchError("No chart result from Yahoo Finance")

    timestamps = result[0].get("timestamp") or []
    closes = result[0]["indicators"]["quote"][0].get("close") or []
    prices: dict[str, float] = {}
    for timestamp, close in zip(timestamps, closes, strict=False):
        if close is None:
            continue
        day = datetime.fromtimestamp(timestamp, UTC).date().isoformat()
        prices[day] = float(close)
    return prices


def fetch_price_history(
    asset_type: AssetType, symbol: str, start: date, end: date
) -> dict[str, float]:
    if asset_type == AssetType.STOCK:
        return fetch_yahoo_history(symbol, start, end)
    if asset_type in (
        AssetType.MUTUAL_FUND,
        AssetType.LIQUID_FUND,
        AssetType.ARBITRAGE_FUND,
    ):
        return fetch_mfapi_history(symbol)
    raise FetchError(f"Unsupported asset type for price history: {asset_type}")


def fetch_market_price(asset_type: AssetType, symbol: str) -> tuple[float, str]:
    if asset_type == AssetType.STOCK:
        return fetch_yahoo_finance(symbol)
    if asset_type in (
        AssetType.MUTUAL_FUND,
        AssetType.LIQUID_FUND,
        AssetType.ARBITRAGE_FUND,
    ):
        return fetch_mfapi(symbol)
    raise FetchError(f"Unsupported asset type for market data: {asset_type}")


def sync_asset_price(session: Session, asset: Asset) -> MarketDataCache | None:
    if asset.asset_type == AssetType.PHYSICAL_GOLD:
        purity = purity_from_asset(asset)
        cache = get_cached_gold_rate(session, purity)
        if cache is not None:
            return cache
        try:
            return sync_gold_rates(session).get(purity)
        except GoldRateError:
            return None

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


def sync_all_market_data(session: Session) -> None:
    """Sync every asset, fetching the shared gold rates only once."""
    assets = session.exec(select(Asset)).all()

    if any(asset.asset_type == AssetType.PHYSICAL_GOLD for asset in assets):
        try:
            sync_gold_rates(session)
        except GoldRateError:
            # Keep serving the last successful gold rate if the external
            # provider is temporarily unavailable.
            pass

    for asset in assets:
        if asset.asset_type == AssetType.PHYSICAL_GOLD:
            continue
        sync_asset_price(session, asset)


def get_stale_assets(session: Session) -> list[MarketDataCache]:
    caches = session.exec(select(MarketDataCache)).all()
    return [cache for cache in caches if _is_stale(cache.fetched_at)]
