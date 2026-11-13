"""Daily snapshots of portfolio XIRR.

XIRR depends on the market value of holdings on the day it is calculated.
The app stores one point per day. On first use it backfills history from the
transaction dates using each asset's historical NAV/price series.
"""

from bisect import bisect_right
from datetime import UTC, date, datetime, timedelta

import httpx
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.models import Asset, AssetEntry, MarketDataCache, XirrSnapshot
from app.services.market_data import FetchError, fetch_price_history
from app.services.xirr import get_portfolio_xirr

# Annualizing a few days of returns produces meaningless values (a 1% move
# over one day becomes hundreds of percent annualized). Keep early history
# points as empty gaps until there is a month of data.
MIN_HISTORY_DAYS = 30


def record_xirr_snapshot(
    session: Session, snapshot_date: date | None = None
) -> XirrSnapshot:
    """Create or update the XIRR snapshot for a day."""
    day = (snapshot_date or date.today()).isoformat()
    rate = get_portfolio_xirr(session)

    snapshot = session.exec(
        select(XirrSnapshot).where(XirrSnapshot.date == day)
    ).first()
    if snapshot:
        snapshot.xirr = rate
        snapshot.updated_at = datetime.now(UTC)
    else:
        snapshot = XirrSnapshot(date=day, xirr=rate)
        session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot


def get_xirr_history(session: Session) -> list[XirrSnapshot]:
    return session.exec(select(XirrSnapshot).order_by(XirrSnapshot.date)).all()


def has_historical_snapshots(session: Session, today: date | None = None) -> bool:
    day = (today or date.today()).isoformat()
    return (
        session.exec(select(XirrSnapshot).where(XirrSnapshot.date < day)).first()
        is not None
    )


def _load_prices(
    session: Session, asset: Asset, start: date, end: date
) -> tuple[dict[str, float], list[str], float | None]:
    """Return historical prices, sorted dates, and a fallback price."""
    cache = session.exec(
        select(MarketDataCache).where(
            MarketDataCache.asset_type == asset.asset_type,
            MarketDataCache.symbol == asset.symbol,
        )
    ).first()
    fallback = cache.price if cache else None

    prices: dict[str, float] = {}
    if asset.symbol:
        try:
            prices = fetch_price_history(asset.asset_type, asset.symbol, start, end)
        except (FetchError, httpx.HTTPError, KeyError, TypeError, ValueError):
            prices = {}
    return prices, sorted(prices), fallback


def _price_on_or_before(
    prices: dict[str, float],
    days: list[str],
    target: str,
    fallback: float | None,
) -> float | None:
    """Use the latest available price, or the first known one."""
    if not days:
        return fallback
    index = bisect_right(days, target) - 1
    if index >= 0:
        return prices[days[index]]
    return prices[days[0]]


def backfill_xirr_history(session: Session, today: date | None = None) -> int:
    """Fill missing past XIRR points from the transaction history."""
    end = today or date.today()
    assets = session.exec(
        select(Asset).where(
            Asset.asset_type.in_(["stock", "mutual_fund", "physical_gold"])
        )
    ).all()
    asset_ids = [asset.id for asset in assets if asset.id is not None]
    if not asset_ids:
        return 0

    entries = session.exec(
        select(AssetEntry).where(AssetEntry.asset_id.in_(asset_ids))
    ).all()
    if not entries:
        return 0

    start = min(date.fromisoformat(entry.date) for entry in entries)
    existing = {snapshot.date for snapshot in get_xirr_history(session)}
    missing = [
        start + timedelta(days=offset)
        for offset in range((end - start).days)
        if (start + timedelta(days=offset)).isoformat() not in existing
    ]
    if not missing:
        return 0

    # Gold has no historical price series in this app; get_portfolio_xirr
    # values past gold points at their metal cost basis. Do not pass the
    # current gold rate through the override map for historical dates.
    price_data = {
        asset.id: _load_prices(session, asset, start, end)
        for asset in assets
        if asset.id is not None and asset.asset_type != AssetType.PHYSICAL_GOLD
    }

    for day in missing:
        overrides: dict[int, float] = {}
        for asset in assets:
            if asset.id is None or asset.asset_type == AssetType.PHYSICAL_GOLD:
                continue
            prices, days, fallback = price_data[asset.id]
            price = _price_on_or_before(prices, days, day.isoformat(), fallback)
            if price is not None:
                overrides[asset.id] = price
        session.add(
            XirrSnapshot(
                date=day.isoformat(),
                xirr=(
                    get_portfolio_xirr(session, as_of=day, price_overrides=overrides)
                    if (day - start).days >= MIN_HISTORY_DAYS
                    else None
                ),
            )
        )

    session.commit()
    return len(missing)


def recalculate_xirr_history(session: Session, today: date | None = None) -> int:
    """Rebuild every stored XIRR point from the current entries and prices.

    Unlike :func:`backfill_xirr_history`, this also refreshes points that
    already exist, so edits to old entries are reflected in the trend.
    """
    end = today or date.today()
    session.exec(XirrSnapshot.__table__.delete())
    session.commit()
    added = backfill_xirr_history(session, today=end)
    record_xirr_snapshot(session, snapshot_date=end)
    return added + 1


def ensure_xirr_history(session: Session) -> None:
    """Backfill once, then let the daily job maintain the series."""
    if not has_historical_snapshots(session):
        backfill_xirr_history(session)
