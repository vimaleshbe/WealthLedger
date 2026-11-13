"""Return summaries for portfolio reporting scopes.

Long-term holdings (more than one year) are annualized as CAGR:

    (current value / net invested) ** (1 / years) - 1

Short-term holdings stay as absolute return:

    current value / net invested - 1

Annualizing a few days or months of performance exaggerates the number, so
the dashboard reports absolute return until the scope has a full year of
history. XIRR remains the money-weighted, annualized metric.
"""

from dataclasses import dataclass
from datetime import date

from sqlmodel import Session, select

from app.core.entry_types import EntryType
from app.models import AssetEntry
from app.services.cash import get_asset_invested_value
from app.services.valuation import get_asset_current_value
from app.services.xirr import get_scope_assets

DAYS_PER_YEAR = 365.25
LONG_TERM_DAYS = 365


@dataclass(frozen=True)
class ScopeReturn:
    scope: str
    metric: str
    percent: float | None
    absolute: float | None
    cagr: float | None
    period_days: int | None


def get_scope_return(
    session: Session,
    scope: str = "portfolio",
    as_of: date | None = None,
) -> ScopeReturn:
    """Return absolute or annualized performance for a reporting scope."""
    assets = get_scope_assets(session, scope)
    asset_ids = [asset.id for asset in assets if asset.id is not None]
    empty = ScopeReturn(scope, "absolute", None, None, None, None)
    if not asset_ids:
        return empty

    today = as_of or date.today()
    entries = session.exec(
        select(AssetEntry).where(AssetEntry.asset_id.in_(asset_ids))
    ).all()
    purchase_dates = [
        date.fromisoformat(entry.date)
        for entry in entries
        if entry.entry_type == EntryType.BUY and date.fromisoformat(entry.date) <= today
    ]
    if not purchase_dates:
        return empty

    days = (today - min(purchase_dates)).days
    invested = sum(
        get_asset_invested_value(session, asset_id) for asset_id in asset_ids
    )
    if invested <= 0:
        return ScopeReturn(scope, "absolute", None, None, None, days)

    current = sum(get_asset_current_value(session, asset) for asset in assets)
    absolute = current / invested - 1
    cagr = None
    if days > 0:
        cagr = (current / invested) ** (DAYS_PER_YEAR / days) - 1

    if days > LONG_TERM_DAYS:
        return ScopeReturn(scope, "cagr", cagr, absolute, cagr, days)
    return ScopeReturn(scope, "absolute", absolute, absolute, cagr, days)
