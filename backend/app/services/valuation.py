"""Asset valuation helpers shared by the API and dashboard."""

from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.core.gold import purity_from_asset
from app.models import Asset, MarketDataCache
from app.services.cash import get_asset_invested_value, get_asset_units
from app.services.gold_rates import get_cached_gold_rate


def get_price_cache(session: Session, asset: Asset) -> MarketDataCache | None:
    """Return the cached price row used to value an asset."""
    if asset.asset_type == AssetType.PHYSICAL_GOLD:
        return get_cached_gold_rate(session, purity_from_asset(asset))
    if not asset.symbol:
        return None
    return session.exec(
        select(MarketDataCache).where(
            MarketDataCache.asset_type == asset.asset_type,
            MarketDataCache.symbol == asset.symbol,
        )
    ).first()


def get_asset_current_value(session: Session, asset: Asset) -> float:
    """Return the market value from cached units, falling back to cost."""
    invested = get_asset_invested_value(session, asset.id)
    cache = get_price_cache(session, asset)
    if not cache:
        return invested
    units = get_asset_units(session, asset.id)
    return round(units * cache.price, 2)


def get_asset_portfolio_value(session: Session, asset: Asset) -> float:
    """Value used in portfolio totals.

    Physical gold is marked to the latest 22K/24K rate per gram. Other assets
    keep the existing cost-basis behaviour.
    """
    if asset.asset_type == AssetType.PHYSICAL_GOLD:
        return get_asset_current_value(session, asset)
    return get_asset_invested_value(session, asset.id)


def get_price_unit(asset: Asset) -> str:
    return "gram" if asset.asset_type == AssetType.PHYSICAL_GOLD else "unit"
