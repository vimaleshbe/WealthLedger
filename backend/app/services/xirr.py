from datetime import date, datetime

from sqlmodel import Session, select

from app.core.entry_types import EntryType
from app.models import Asset, AssetEntry, MarketDataCache


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


def get_portfolio_xirr(session: Session) -> float | None:
    """Calculate portfolio XIRR for stocks and mutual funds only."""
    assets = session.exec(
        select(Asset).where(Asset.asset_type.in_(["stock", "mutual_fund"]))
    ).all()

    cashflows: list[tuple[date, float]] = []
    today = date.today()

    for asset in assets:
        entries = session.exec(
            select(AssetEntry).where(AssetEntry.asset_id == asset.id)
        ).all()
        if not entries:
            continue

        for entry in entries:
            entry_date = datetime.strptime(entry.date, "%Y-%m-%d").date()
            if entry.entry_type == EntryType.SELL:
                # Sale proceeds are an inflow back into the portfolio
                cash_value = (
                    entry.cash_value if entry.cash_value is not None else entry.value
                )
                cashflows.append((entry_date, cash_value))
            else:
                # Investment is an outflow
                cashflows.append((entry_date, -entry.value))

        # Current value is an inflow as of today
        invested_value = 0.0
        total_units = 0.0
        for entry in entries:
            if entry.entry_type == EntryType.BUY:
                invested_value += entry.value
                total_units += entry.units
            elif entry.entry_type == EntryType.SELL:
                invested_value -= entry.value
                total_units -= entry.units

        invested_value = max(invested_value, 0.0)
        total_units = max(total_units, 0.0)

        cache = None
        if asset.symbol:
            cache = session.exec(
                select(MarketDataCache).where(
                    MarketDataCache.asset_type == asset.asset_type,
                    MarketDataCache.symbol == asset.symbol,
                )
            ).first()

        current_value = round(total_units * cache.price, 2) if cache else invested_value
        cashflows.append((today, current_value))

    if len(cashflows) < 2:
        return None

    return calculate_xirr(cashflows)
