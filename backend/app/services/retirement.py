"""Retirement balance accounts: PF, PPF and NPS.

These are balance accounts rather than market holdings. They count in net
worth but are presented in a separate Retirement tab and are excluded from
Total Portfolio and XIRR.

PF contributions can carry the three passbook amounts (employee, employer and
pension). PPF and NPS use a single contribution amount. All three support
interest/growth credits and withdrawals.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlmodel import Session, select

from app.core.asset_types import (
    RETIREMENT_ASSET_TYPES,
    AssetType,
    get_category,
)
from app.core.entry_types import EntryType
from app.models import Asset, AssetEntry

PPF_TENURE_YEARS = 15

RETIREMENT_NAMES: dict[AssetType, str] = {
    AssetType.PF: "PF",
    AssetType.PPF: "PPF",
    AssetType.NPS: "NPS",
}

RETIREMENT_NOTES: dict[AssetType, str] = {
    AssetType.PF: "Provident Fund balance account.",
    AssetType.PPF: "Public Provident Fund balance account.",
    AssetType.NPS: "National Pension System balance account.",
}


class PFDetailsError(ValueError):
    pass


@dataclass(frozen=True)
class PFContribution:
    employee_share: float
    employer_share: float
    pension_share: float
    unclassified_total: float = 0.0

    @property
    def total(self) -> float:
        return round(
            self.employee_share
            + self.employer_share
            + self.pension_share
            + self.unclassified_total,
            2,
        )

    def as_entry_details(self) -> dict[str, float]:
        details = {
            "employee_share": round(self.employee_share, 2),
            "employer_share": round(self.employer_share, 2),
            "pension_share": round(self.pension_share, 2),
        }
        if self.unclassified_total:
            details["unclassified_total"] = round(self.unclassified_total, 2)
        return details


@dataclass(frozen=True)
class RetirementSummary:
    asset_id: int
    asset_type: str
    balance: float
    invested_value: float
    contributions: float
    employee_total: float
    employer_total: float
    pension_total: float
    interest_total: float
    withdrawal_total: float
    unclassified_total: float
    entry_count: int
    last_contribution_date: str | None
    first_contribution_date: str | None = None
    maturity_date: str | None = None
    units: float = 0.0
    latest_nav: float | None = None
    gain: float = 0.0


def is_retirement_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type in RETIREMENT_ASSET_TYPES)


def is_pf_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type == AssetType.PF)


def is_ppf_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type == AssetType.PPF)


def is_nps_asset(asset: Asset | None) -> bool:
    return bool(asset and asset.asset_type == AssetType.NPS)


def get_ppf_maturity_date(opened_on: str | None) -> str | None:
    """Return the 15-year maturity date for a PPF account.

    A PPF account opens with its first contribution, so the first contribution
    date is used as the opening date.
    """
    if not opened_on:
        return None
    try:
        opened = date.fromisoformat(opened_on)
    except ValueError:
        return None
    try:
        matured = opened.replace(year=opened.year + PPF_TENURE_YEARS)
    except ValueError:
        # A 29 February opening matures on 28 February in the maturity year.
        matured = opened.replace(
            year=opened.year + PPF_TENURE_YEARS,
            day=28,
        )
    return matured.isoformat()


def _as_iso(value: date | str | None) -> str | None:
    if value is None:
        return None
    return value.isoformat() if isinstance(value, date) else value


def _number(value: object, label: str) -> float:
    if value in (None, ""):
        return 0.0
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise PFDetailsError(f"{label} must be a number.") from exc
    if number != number or number in (float("inf"), float("-inf")):
        raise PFDetailsError(f"{label} must be a number.")
    return number


def _non_negative(value: object, label: str) -> float:
    number = _number(value, label)
    if number < 0:
        raise PFDetailsError(f"{label} cannot be negative.")
    return number


def parse_pf_contribution(
    details: dict[str, Any] | None,
    fallback_value: float | None = None,
) -> PFContribution:
    """Validate the three passbook amounts for a PF contribution.

    An entry with no component keys is kept as an unclassified contribution
    instead of being rejected, so legacy PF entries still work.
    """
    data = details or {}
    component_keys = {
        "employee_share",
        "employer_share",
        "employer_epf_share",
        "pension_share",
        "vpf",
    }
    if not component_keys.intersection(data):
        if fallback_value is None or fallback_value <= 0:
            raise PFDetailsError(
                "Enter at least one of employee, employer or pension amount."
            )
        return PFContribution(
            employee_share=0.0,
            employer_share=0.0,
            pension_share=0.0,
            unclassified_total=round(fallback_value, 2),
        )

    employee = _non_negative(data.get("employee_share", 0), "Employee share")
    employee += _non_negative(data.get("vpf", 0), "VPF")
    employer = _non_negative(
        data.get("employer_share", data.get("employer_epf_share", 0)),
        "Employer share",
    )
    pension = _non_negative(data.get("pension_share", 0), "Pension share")

    contribution = PFContribution(
        employee_share=round(employee, 2),
        employer_share=round(employer, 2),
        pension_share=round(pension, 2),
    )
    if contribution.total <= 0:
        raise PFDetailsError(
            "Enter at least one of employee, employer or pension amount."
        )
    return contribution


def ensure_retirement_accounts(session: Session) -> list[Asset]:
    """Return the retirement accounts, creating one per missing scheme.

    This mirrors the managed Cash asset. Existing accounts (including multiple
    accounts of one type) are preserved.
    """
    accounts = session.exec(
        select(Asset)
        .where(Asset.asset_type.in_(tuple(RETIREMENT_ASSET_TYPES)))
        .order_by(Asset.id)
    ).all()
    existing_types = {account.asset_type for account in accounts}
    changed = False

    for asset_type in (AssetType.PF, AssetType.PPF, AssetType.NPS):
        if asset_type in existing_types:
            continue
        session.add(
            Asset(
                name=RETIREMENT_NAMES[asset_type],
                asset_type=asset_type,
                category=get_category(asset_type),
                notes=RETIREMENT_NOTES[asset_type],
            )
        )
        changed = True

    if changed:
        session.commit()

    return list(
        session.exec(
            select(Asset)
            .where(Asset.asset_type.in_(tuple(RETIREMENT_ASSET_TYPES)))
            .order_by(Asset.id)
        ).all()
    )


def get_retirement_entries(
    session: Session,
    asset_id: int,
    as_of: date | str | None = None,
) -> list[AssetEntry]:
    entries = session.exec(
        select(AssetEntry)
        .where(AssetEntry.asset_id == asset_id)
        .order_by(AssetEntry.date, AssetEntry.id)
    ).all()
    cutoff = _as_iso(as_of)
    if cutoff is None:
        return list(entries)
    return [entry for entry in entries if entry.date <= cutoff]


def _entry_nav(entry: AssetEntry) -> float | None:
    details = entry.details or {}
    for key in ("nav", "nps_nav", "price"):
        value = details.get(key)
        if value in (None, ""):
            continue
        try:
            nav = float(value)
        except (TypeError, ValueError):
            continue
        if nav > 0:
            return nav
    return None


def get_retirement_summary(
    session: Session,
    asset_id: int,
    as_of: date | str | None = None,
) -> RetirementSummary:
    asset = session.get(Asset, asset_id)
    asset_type = asset.asset_type if asset else AssetType.PF
    entries = get_retirement_entries(session, asset_id, as_of=as_of)

    contributions = 0.0
    employee = 0.0
    employer = 0.0
    pension = 0.0
    interest = 0.0
    withdrawals = 0.0
    units = 0.0
    latest_nav: float | None = None
    last_contribution_date: str | None = None
    first_contribution_date: str | None = None

    for entry in entries:
        if entry.entry_type == EntryType.BUY:
            contributions += entry.value
            units += entry.units
            if entry.date and (
                last_contribution_date is None or entry.date >= last_contribution_date
            ):
                last_contribution_date = entry.date
            if entry.date and (
                first_contribution_date is None or entry.date < first_contribution_date
            ):
                first_contribution_date = entry.date
            if asset_type == AssetType.PF:
                details = entry.details or {}
                employee += _number(details.get("employee_share"), "Employee share")
                employee += _number(details.get("vpf"), "VPF")
                employer += _number(
                    details.get("employer_share", details.get("employer_epf_share")),
                    "Employer share",
                )
                pension += _number(details.get("pension_share"), "Pension share")
        elif entry.entry_type == EntryType.SELL:
            withdrawals += entry.value
            units -= entry.units
        elif entry.entry_type == EntryType.INTEREST:
            interest += entry.value

        nav = _entry_nav(entry)
        if nav is not None:
            latest_nav = nav

    contributions = round(contributions, 2)
    withdrawals = round(withdrawals, 2)
    interest = round(interest, 2)
    employee = round(employee, 2)
    employer = round(employer, 2)
    pension = round(pension, 2)
    component_total = round(employee + employer + pension, 2)
    unclassified = (
        round(max(contributions - component_total, 0.0), 2)
        if asset_type == AssetType.PF
        else 0.0
    )

    if asset_type == AssetType.NPS:
        units = round(max(units, 0.0), 4)
        invested = round(max(contributions - withdrawals, 0.0), 2)
        balance = (
            round(units * latest_nav, 2)
            if latest_nav is not None
            else round(max(contributions - withdrawals + interest, 0.0), 2)
        )
        gain = round(balance - invested, 2)
    else:
        units = 0.0
        latest_nav = None
        invested = round(max(contributions - withdrawals, 0.0), 2)
        balance = round(contributions + interest - withdrawals, 2)
        gain = round(balance - invested, 2)

    return RetirementSummary(
        asset_id=asset_id,
        asset_type=asset_type.value,
        balance=balance,
        invested_value=invested,
        contributions=contributions,
        employee_total=employee,
        employer_total=employer,
        pension_total=pension,
        interest_total=interest,
        withdrawal_total=withdrawals,
        unclassified_total=unclassified,
        entry_count=len(entries),
        last_contribution_date=last_contribution_date,
        first_contribution_date=first_contribution_date,
        maturity_date=(
            get_ppf_maturity_date(first_contribution_date)
            if asset_type == AssetType.PPF
            else None
        ),
        units=units,
        latest_nav=latest_nav,
        gain=gain,
    )


def get_retirement_balance(
    session: Session,
    asset_id: int,
    as_of: date | str | None = None,
) -> float:
    return get_retirement_summary(session, asset_id, as_of=as_of).balance


def get_retirement_invested_value(
    session: Session,
    asset_id: int,
    as_of: date | str | None = None,
) -> float:
    return get_retirement_summary(session, asset_id, as_of=as_of).invested_value


def get_retirement_units(
    session: Session,
    asset_id: int,
    as_of: date | str | None = None,
) -> float:
    return get_retirement_summary(session, asset_id, as_of=as_of).units


def validate_nps_units(session: Session, asset_id: int) -> str | None:
    units = 0.0
    for entry in get_retirement_entries(session, asset_id):
        if entry.entry_type == EntryType.BUY:
            units += entry.units
        elif entry.entry_type == EntryType.SELL:
            if entry.units > units + 1e-9:
                return (
                    "Cannot redeem more NPS units than are held on that date. "
                    f"Available: {units:g} units."
                )
            units -= entry.units
    return None


def validate_retirement_balance(session: Session, asset_id: int) -> str | None:
    if get_retirement_balance(session, asset_id) < -0.005:
        return "Retirement withdrawal cannot exceed the account balance."
    return None
