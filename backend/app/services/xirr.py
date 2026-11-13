from datetime import date, datetime

from sqlmodel import Session, select

from app.core.asset_types import AssetType, Category, get_effective_category
from app.core.entry_types import EntryType
from app.core.gold import purity_from_asset
from app.models import Asset, AssetEntry, MarketDataCache
from app.services.gold_rates import get_cached_gold_rate


def _days_between(start: date, end: date) -> float:
    return (end - start).days


def _npv(rate: float, cashflows: list[tuple[date, float]]) -> float:
    if rate <= -1:
        return float("inf")
    return sum(amount / ((1 + rate) ** (days / 365)) for days, amount in cashflows)


def _derive_npv(rate: float, cashflows: list[tuple[float, float]]) -> float:
    if rate <= -1:
        return float("inf")
    return sum(
        -amount * days / 365 / ((1 + rate) ** (days / 365 + 1))
        for days, amount in cashflows
    )


def calculate_xirr(cashflows: list[tuple[date, float]]) -> float | None:
    """Calculate XIRR given a list of (date, amount) tuples.

    Outflows (investments) are negative, inflows (current value) are positive.
    Returns None if no convergence.
    """
    if len(cashflows) < 2:
        return None

    min_date = min(d for d, _ in cashflows)
    normalized = [(_days_between(min_date, d), amount) for d, amount in cashflows]

    rate = 0.1
    for _ in range(100):
        npv = _npv(rate, normalized)
        derivative = _derive_npv(rate, normalized)
        if derivative == 0:
            break
        new_rate = rate - npv / derivative
        if abs(new_rate - rate) < 1e-6:
            return new_rate
        rate = new_rate

    # Newton-Raphson may diverge; fall back to binary search between -0.99 and 10
    low, high = -0.99, 10.0
    npv_low = _npv(low, normalized)
    npv_high = _npv(high, normalized)
    if npv_low * npv_high > 0:
        return None

    for _ in range(100):
        mid = (low + high) / 2
        npv_mid = _npv(mid, normalized)
        if abs(npv_mid) < 1e-6:
            return mid
        if npv_low * npv_mid <= 0:
            high = mid
            npv_high = npv_mid
        else:
            low = mid
            npv_low = npv_mid

    return (low + high) / 2


XIRR_SCOPES = ("portfolio", "equity", "gold")


def get_scope_assets(session: Session, scope: str) -> list[Asset]:
    """Return the assets that belong to a reporting scope."""
    if scope not in XIRR_SCOPES:
        raise ValueError(f"Unknown XIRR scope: {scope}")

    asset_types = [
        AssetType.STOCK.value,
        AssetType.MUTUAL_FUND.value,
        AssetType.PHYSICAL_GOLD.value,
    ]
    if scope == "portfolio":
        asset_types.append(AssetType.PPF.value)

    assets = session.exec(select(Asset).where(Asset.asset_type.in_(asset_types))).all()
    if scope == "portfolio":
        return list(assets)

    want_gold = scope == "gold"
    return [
        asset
        for asset in assets
        if (
            get_effective_category(asset.asset_type, asset.name, asset.symbol)
            == Category.GOLD
        )
        == want_gold
    ]


def get_portfolio_xirr(
    session: Session,
    as_of: date | None = None,
    price_overrides: dict[int, float] | None = None,
    scope: str = "portfolio",
) -> float | None:
    """Calculate XIRR for a reporting scope.

    * ``portfolio`` — stocks, mutual funds, physical gold and PPF.
    * ``equity`` — stocks and non-gold mutual funds; gold ETFs/funds excluded.
    * ``gold`` — physical gold plus gold ETFs/funds.

    ``as_of`` values the portfolio on a historical date. ``price_overrides``
    lets the history backfill supply that day's market price per asset.
    Physical gold uses the latest cached 22K/24K rate for today's valuation,
    and falls back to its metal cost basis when no live rate is available.
    """
    assets = get_scope_assets(session, scope)

    cashflows: list[tuple[date, float]] = []
    valuation_date = as_of or date.today()

    for asset in assets:
        entries = session.exec(
            select(AssetEntry).where(AssetEntry.asset_id == asset.id)
        ).all()
        if not entries:
            continue

        has_flows = False
        for entry in entries:
            entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
            if entry_date > valuation_date:
                continue
            has_flows = True
            if entry.entry_type == EntryType.SELL:
                # Sale proceeds are an inflow back into the portfolio
                cash_value = (
                    entry.cash_value if entry.cash_value is not None else entry.value
                )
                cashflows.append((entry_date, cash_value))
            else:
                # Investment is an outflow. For gold this is the full invoice
                # amount, including wastage and GST, because that is what left
                # the investor's cash.
                outflow = entry.value
                if asset.asset_type == AssetType.PHYSICAL_GOLD:
                    outflow = (
                        entry.cash_value
                        if entry.cash_value is not None
                        else entry.value
                    )
                cashflows.append((entry_date, -outflow))

        if not has_flows:
            continue

        # Current value is an inflow as of the valuation date
        invested_value = 0.0
        total_units = 0.0
        for entry in entries:
            entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
            if entry_date > valuation_date:
                continue
            if entry.entry_type == EntryType.BUY:
                invested_value += entry.value
                total_units += entry.units
            elif entry.entry_type == EntryType.SELL:
                invested_value -= entry.value
                total_units -= entry.units

        invested_value = max(invested_value, 0.0)
        total_units = max(total_units, 0.0)

        cache = None
        if asset.asset_type == AssetType.PHYSICAL_GOLD:
            # The cached gold rate is a today-only valuation. Historical
            # XIRR points fall back to the metal cost basis rather than
            # applying today's rate to a past date.
            if valuation_date == date.today():
                cache = get_cached_gold_rate(session, purity_from_asset(asset))
        elif asset.symbol:
            cache = session.exec(
                select(MarketDataCache).where(
                    MarketDataCache.asset_type == asset.asset_type,
                    MarketDataCache.symbol == asset.symbol,
                )
            ).first()

        price = price_overrides.get(asset.id) if price_overrides else None
        if price is None:
            price = cache.price if cache else None
        current_value = round(total_units * price, 2) if price else invested_value
        cashflows.append((valuation_date, current_value))

    if len(cashflows) < 2:
        return None

    return calculate_xirr(cashflows)
