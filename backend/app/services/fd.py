"""Fixed deposit accounts.

FDs are regular assets with a principal, tenure and annual interest rate.
Multiple FDs are supported. Interest credits are recorded as INTEREST entries
and grow the FD balance without adding invested capital.
"""

import calendar
from dataclasses import dataclass
from datetime import date

from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.core.entry_types import EntryType
from app.models import Asset, AssetEntry


@dataclass(frozen=True)
class FDSummary:
    asset_id: int
    name: str
    principal: float
    interest: float
    withdrawals: float
    balance: float
    invested_value: float
    interest_rate: float | None
    start_date: str | None
    tenure_months: int | None
    maturity_date: str | None
    days_remaining: int | None
    maturity_value: float | None
    entry_count: int


def is_fd_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type == AssetType.FIXED_DEPOSIT)


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _number(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def get_fd_summary(session: Session, asset_id: int) -> FDSummary:
    asset = session.get(Asset, asset_id)
    if not is_fd_asset(asset):
        raise ValueError("Fixed deposit not found")

    entries = session.exec(
        select(AssetEntry)
        .where(AssetEntry.asset_id == asset_id)
        .order_by(AssetEntry.date, AssetEntry.id)
    ).all()

    principal = 0.0
    interest = 0.0
    withdrawals = 0.0
    first_buy_date: str | None = None

    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            principal += entry.value
            if first_buy_date is None or entry.date < first_buy_date:
                first_buy_date = entry.date
        elif entry.entry_type == EntryType.INTEREST:
            interest += entry.value
        elif entry.entry_type == EntryType.SELL:
            withdrawals += entry.value

    details = asset.details or {}
    start_date = details.get("start_date") or first_buy_date
    tenure_months: int | None = None
    raw_tenure = details.get("tenure_months")
    if raw_tenure not in (None, ""):
        try:
            tenure_months = int(raw_tenure)
        except (TypeError, ValueError):
            tenure_months = None
    interest_rate = _number(details.get("interest_rate"))

    maturity_date: str | None = None
    days_remaining: int | None = None
    maturity_value: float | None = None
    if start_date:
        try:
            start = date.fromisoformat(str(start_date))
        except ValueError:
            start = None
        if start and tenure_months and tenure_months > 0:
            matured = _add_months(start, tenure_months)
            maturity_date = matured.isoformat()
            days_remaining = (matured - date.today()).days
            if interest_rate is not None and interest_rate >= 0 and principal > 0:
                years = tenure_months / 12
                maturity_value = round(
                    principal * (1 + interest_rate / 100) ** years,
                    2,
                )

    principal = round(principal, 2)
    interest = round(interest, 2)
    withdrawals = round(withdrawals, 2)
    balance = round(principal + interest - withdrawals, 2)
    invested = round(max(principal - withdrawals, 0.0), 2)

    return FDSummary(
        asset_id=asset_id,
        name=asset.name,
        principal=principal,
        interest=interest,
        withdrawals=withdrawals,
        balance=balance,
        invested_value=invested,
        interest_rate=interest_rate,
        start_date=str(start_date) if start_date else None,
        tenure_months=tenure_months,
        maturity_date=maturity_date,
        days_remaining=days_remaining,
        maturity_value=maturity_value,
        entry_count=len(entries),
    )


def get_fd_balance(session: Session, asset_id: int) -> float:
    return get_fd_summary(session, asset_id).balance


def validate_fd_balance(session: Session, asset_id: int) -> str | None:
    if get_fd_balance(session, asset_id) < -0.005:
        return "FD withdrawal cannot exceed the FD balance."
    return None
