"""Annualized (CAGR) returns for portfolio reporting scopes.

CAGR is the annualized growth of invested capital:

    (current value / net invested) ** (1 / years) - 1

``years`` runs from the first purchase in the scope to today. XIRR handles
the exact timing of every cashflow; CAGR gives the simpler "how fast did the
capital grow" view.
"""

from datetime import date

from sqlmodel import Session, select

from app.core.entry_types import EntryType
from app.models import AssetEntry
from app.services.cash import get_asset_invested_value
from app.services.valuation import get_asset_current_value
from app.services.xirr import get_scope_assets

DAYS_PER_YEAR = 365.25


def get_scope_cagr(
    session: Session,
    scope: str = "portfolio",
    as_of: date | None = None,
) -> float | None:
    """Return the annualized CAGR for a reporting scope."""
    assets = get_scope_assets(session, scope)
    asset_ids = [asset.id for asset in assets if asset.id is not None]
    if not asset_ids:
        return None

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
        return None

    days = (today - min(purchase_dates)).days
    if days <= 0:
        return None

    invested = sum(
        get_asset_invested_value(session, asset_id) for asset_id in asset_ids
    )
    if invested <= 0:
        return None

    current = sum(get_asset_current_value(session, asset) for asset in assets)
    if current <= 0:
        return -1.0

    years = days / DAYS_PER_YEAR
    return (current / invested) ** (1 / years) - 1
