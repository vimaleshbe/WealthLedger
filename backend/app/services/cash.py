"""Cash ledger helpers.

Cash is a special asset type. Its balance is the sum of every entry that
moves money through cash:

* cash deposits and withdrawals
* purchases (money leaves cash)
* sales (money enters cash)

Older entries created before cash tracking existed have ``affects_cash``
set to False, so they do not change the balance retroactively.
"""

from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.asset_types import AssetType, Category
from app.core.entry_types import EntryType
from app.models import Asset, AssetEntry
from app.services.fd import is_fd_asset
from app.services.retirement import (
    get_retirement_invested_value,
    get_retirement_units,
    is_retirement_asset,
)

CASH_ASSET_NAME = "Cash"
UNITS_EPSILON = 1e-9


def is_cash_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type == AssetType.CASH)


def get_or_create_cash_asset(session: Session) -> Asset:
    """Return the managed cash asset, creating it on first use."""
    asset = session.exec(
        select(Asset).where(Asset.asset_type == AssetType.CASH).order_by(Asset.id)
    ).first()
    if asset:
        return asset

    asset = Asset(
        name=CASH_ASSET_NAME,
        asset_type=AssetType.CASH,
        category=Category.CASH,
        notes="Managed cash balance for purchases and sales.",
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


def entry_cash_value(entry: AssetEntry) -> float:
    return entry.cash_value if entry.cash_value is not None else entry.value


def entry_cash_effect(entry: AssetEntry) -> float:
    """Signed effect of an entry on the cash balance."""
    if not entry.affects_cash:
        return 0.0

    amount = entry_cash_value(entry)
    if entry.entry_type in (EntryType.BUY, EntryType.WITHDRAWAL):
        return -amount
    if entry.entry_type in (EntryType.SELL, EntryType.DEPOSIT):
        return amount
    return 0.0


def entry_net_worth_effect(entry: AssetEntry) -> float:
    """Signed effect of an entry on net worth.

    Buying an asset moves money from cash into the holding, so it does not
    change net worth. Selling realises any gain or loss, which does.
    Legacy purchases (affects_cash=False) keep their historical behaviour and
    add to net worth directly.
    """
    details = entry.details or {}
    if entry.entry_type == EntryType.BUY:
        effect = entry.value
        if entry.affects_cash:
            effect -= entry_cash_value(entry)
        return effect
    if entry.entry_type == EntryType.SELL:
        if details.get("retirement_withdrawal") and not entry.affects_cash:
            return -entry.value
        return entry_cash_value(entry) - entry.value
    if entry.entry_type == EntryType.DEPOSIT:
        return entry.value
    if entry.entry_type == EntryType.WITHDRAWAL:
        return -entry.value
    if entry.entry_type == EntryType.INTEREST:
        return entry.value
    return 0.0


def get_cash_balance(session: Session) -> float:
    entries = session.exec(
        select(AssetEntry).where(AssetEntry.affects_cash == True)  # noqa: E712
    ).all()
    balance = round(sum(entry_cash_effect(entry) for entry in entries), 2)
    # Avoid returning -0.0 when sub-paisa rounding leaves a tiny deficit.
    return 0.0 if balance == 0 else balance


def get_cash_totals(session: Session) -> dict[str, float]:
    entries = session.exec(select(AssetEntry)).all()
    deposits = sum(
        entry.value
        for entry in entries
        if entry.affects_cash and entry.entry_type == EntryType.DEPOSIT
    )
    withdrawals = sum(
        entry.value
        for entry in entries
        if entry.affects_cash and entry.entry_type == EntryType.WITHDRAWAL
    )
    buys = sum(
        entry_cash_value(entry)
        for entry in entries
        if entry.affects_cash and entry.entry_type == EntryType.BUY
    )
    sells = sum(
        entry_cash_value(entry)
        for entry in entries
        if entry.affects_cash and entry.entry_type == EntryType.SELL
    )
    return {
        "total_deposits": round(deposits, 2),
        "total_withdrawals": round(withdrawals, 2),
        "total_buys": round(buys, 2),
        "total_sells": round(sells, 2),
    }


def get_asset_entries(session: Session, asset_id: int) -> list[AssetEntry]:
    return session.exec(
        select(AssetEntry)
        .where(AssetEntry.asset_id == asset_id)
        .order_by(AssetEntry.date, AssetEntry.id)
    ).all()


def get_asset_invested_value(session: Session, asset_id: int) -> float:
    """Return the remaining cost basis of an asset."""
    asset = session.get(Asset, asset_id)
    if is_retirement_asset(asset):
        return get_retirement_invested_value(session, asset_id)

    entries = get_asset_entries(session, asset_id)
    total = 0.0
    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            total += entry.value
        elif entry.entry_type == EntryType.SELL:
            total -= entry.value
    return round(max(total, 0.0), 2)


def get_asset_units(session: Session, asset_id: int) -> float:
    asset = session.get(Asset, asset_id)
    if is_retirement_asset(asset):
        if asset is not None and asset.asset_type == AssetType.NPS:
            return get_retirement_units(session, asset_id)
        return 0.0
    if is_fd_asset(asset):
        return 0.0

    entries = get_asset_entries(session, asset_id)
    total = 0.0
    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            total += entry.units
        elif entry.entry_type == EntryType.SELL:
            total -= entry.units
    return round(max(total, 0.0), 6)


def is_closed_asset(session: Session, asset: Asset) -> bool:
    """Return True when an asset has entries but no units left.

    Assets created without an initial holding have no entries and stay
    visible so they can be edited. A fully sold holding is considered closed
    and should not appear in active lists or counts. Retirement accounts are
    balance accounts and never close through unit sales.
    """
    if is_cash_asset(asset) or is_retirement_asset(asset) or is_fd_asset(asset):
        return False

    entries = get_asset_entries(session, asset.id)
    if not entries:
        return False

    units = 0.0
    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            units += entry.units
        elif entry.entry_type == EntryType.SELL:
            units -= entry.units
    return units <= UNITS_EPSILON


def recalculate_asset_cost_basis(session: Session, asset_id: int) -> None:
    """Recompute the cost basis stored on each sale of an asset.

    The portfolio tracks cost basis using a moving average. Whenever a buy
    or sale changes (including back-dated edits), later sales are recalculated
    so the "invested" figure and realised gains stay consistent.
    """
    asset = session.get(Asset, asset_id)
    if (
        not asset
        or is_cash_asset(asset)
        or is_retirement_asset(asset)
        or is_fd_asset(asset)
    ):
        return

    entries = get_asset_entries(session, asset_id)
    units = 0.0
    cost = 0.0

    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            units += entry.units
            cost += entry.value
        elif entry.entry_type == EntryType.SELL:
            if units <= UNITS_EPSILON:
                basis = 0.0
            else:
                average_cost = cost / units
                basis = min(entry.units * average_cost, cost)
            entry.value = round(max(basis, 0.0), 2)
            cost = max(cost - entry.value, 0.0)
            units = max(units - entry.units, 0.0)
            if units <= UNITS_EPSILON:
                units = 0.0
                cost = 0.0
            if entry.cash_value is None:
                entry.cash_value = entry.value

    session.flush()


def validate_asset_holdings(session: Session, asset_id: int) -> str | None:
    """Return an error message if any sale exceeds the units held then."""
    asset = session.get(Asset, asset_id)
    if (
        not asset
        or is_cash_asset(asset)
        or is_retirement_asset(asset)
        or is_fd_asset(asset)
    ):
        return None

    entries = get_asset_entries(session, asset_id)
    units = 0.0
    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            units += entry.units
        elif entry.entry_type == EntryType.SELL:
            if entry.units > units + UNITS_EPSILON:
                return (
                    "Cannot sell more units than are held on that date. "
                    f"Available: {units:g} units."
                )
            units -= entry.units
    return None


def validate_cash_balance(session: Session) -> str | None:
    balance = get_cash_balance(session)
    if balance < -0.005:
        return (
            "Cash balance would go negative. Add money to cash before making "
            "this purchase or withdrawal."
        )
    return None


def get_cash_summary(session: Session) -> dict:
    asset = get_or_create_cash_asset(session)
    totals = get_cash_totals(session)
    latest = session.exec(
        select(AssetEntry)
        .where(AssetEntry.affects_cash == True)  # noqa: E712
        .order_by(AssetEntry.updated_at.desc())
    ).first()
    return {
        "asset_id": asset.id,
        "balance": get_cash_balance(session),
        **totals,
        "currency": "INR",
        "last_updated": latest.updated_at if latest else datetime.now(UTC),
    }
