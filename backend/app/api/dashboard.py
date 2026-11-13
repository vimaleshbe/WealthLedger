from datetime import UTC, date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.asset_types import AssetType, get_effective_category
from app.db import get_session
from app.models import Asset, PortfolioSnapshot
from app.schemas import (
    AllocationItem,
    AllocationResponse,
    PortfolioSummary,
    ScopeReturnResponse,
    TrendPoint,
    TrendResponse,
    XirrHistoryPoint,
    XirrHistoryResponse,
    XirrResponse,
)
from app.services.cagr import get_scope_return
from app.services.cash import (
    get_cash_balance,
    get_or_create_cash_asset,
    is_cash_asset,
    is_closed_asset,
)
from app.services.valuation import get_asset_portfolio_value
from app.services.xirr import get_portfolio_xirr
from app.services.xirr_history import (
    get_xirr_history,
    recalculate_xirr_history,
    record_xirr_snapshot,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


PORTFOLIO_ASSET_TYPES = {
    AssetType.STOCK.value,
    AssetType.MUTUAL_FUND.value,
    AssetType.FIXED_DEPOSIT.value,
    AssetType.LIQUID_FUND.value,
    AssetType.ARBITRAGE_FUND.value,
    AssetType.PPF.value,
}


@router.get("/summary", response_model=PortfolioSummary)
def summary(session: Session = Depends(get_session)) -> PortfolioSummary:
    cash_asset = get_or_create_cash_asset(session)
    assets = [
        asset
        for asset in session.exec(select(Asset)).all()
        if not is_cash_asset(asset) and not is_closed_asset(session, asset)
    ]
    cash_value = get_cash_balance(session)

    values = {asset.id: get_asset_portfolio_value(session, asset) for asset in assets}
    net_worth = round(sum(values.values()) + cash_value, 2)
    portfolio_value = round(
        sum(
            values[asset.id]
            for asset in assets
            if asset.asset_type.value in PORTFOLIO_ASSET_TYPES
        ),
        2,
    )

    return PortfolioSummary(
        total_value=net_worth,
        portfolio_value=portfolio_value,
        net_worth=net_worth,
        cash_value=cash_value,
        cash_asset_id=cash_asset.id,
        asset_count=len(assets),
        last_updated=datetime.now(UTC),
    )


@router.get("/allocation", response_model=AllocationResponse)
def allocation(session: Session = Depends(get_session)) -> AllocationResponse:
    assets = [
        asset for asset in session.exec(select(Asset)).all() if not is_cash_asset(asset)
    ]
    category_values: dict[str, float] = {}
    type_values: dict[str, float] = {}
    asset_values: list[tuple[Asset, float]] = []
    total = 0.0

    for asset in assets:
        value = get_asset_portfolio_value(session, asset)
        category = get_effective_category(asset.asset_type, asset.name, asset.symbol)
        if value > 0:
            asset_values.append((asset, value))
        category_values[category.value] = (
            category_values.get(category.value, 0.0) + value
        )
        type_values[asset.asset_type.value] = (
            type_values.get(asset.asset_type.value, 0.0) + value
        )
        total += value

    cash_value = get_cash_balance(session)
    category_values["cash"] = category_values.get("cash", 0.0) + cash_value
    type_values[AssetType.CASH.value] = cash_value
    total += cash_value

    def percentage(value: float) -> float:
        return round((value / total) * 100, 2) if total else 0.0

    def to_items(mapping: dict[str, float], key_name: str) -> list[AllocationItem]:
        return [
            AllocationItem(
                **{key_name: key},
                value=value,
                percentage=percentage(value),
            )
            for key, value in sorted(mapping.items(), key=lambda x: x[1], reverse=True)
            if value > 0
        ]

    by_asset = [
        AllocationItem(
            asset_id=asset.id,
            name=asset.name,
            category=get_effective_category(
                asset.asset_type, asset.name, asset.symbol
            ).value,
            asset_type=asset.asset_type.value,
            value=value,
            percentage=percentage(value),
        )
        for asset, value in asset_values
    ]
    if cash_value > 0:
        by_asset.append(
            AllocationItem(
                name="Cash",
                category="cash",
                asset_type=AssetType.CASH.value,
                value=cash_value,
                percentage=percentage(cash_value),
            )
        )
    by_asset.sort(key=lambda item: item.value, reverse=True)

    return AllocationResponse(
        by_asset=by_asset,
        by_category=to_items(category_values, "category"),
        by_asset_type=to_items(type_values, "asset_type"),
    )


@router.get("/trend", response_model=TrendResponse)
def trend(
    start_date: date | None = None,
    end_date: date | None = None,
    session: Session = Depends(get_session),
) -> TrendResponse:
    query = select(PortfolioSnapshot).order_by(PortfolioSnapshot.date)
    if start_date:
        query = query.where(PortfolioSnapshot.date >= start_date.isoformat())
    if end_date:
        query = query.where(PortfolioSnapshot.date <= end_date.isoformat())

    snapshots = session.exec(query).all()
    return TrendResponse(
        points=[
            TrendPoint(date=snapshot.date, total_value=snapshot.total_value)
            for snapshot in snapshots
        ]
    )


@router.get("/xirr/history", response_model=XirrHistoryResponse)
def xirr_history(session: Session = Depends(get_session)) -> XirrHistoryResponse:
    """Return one XIRR point per recorded day."""
    record_xirr_snapshot(session)
    return XirrHistoryResponse(
        points=[
            XirrHistoryPoint(
                date=snapshot.date,
                xirr_percent=(
                    round(snapshot.xirr * 100, 2) if snapshot.xirr is not None else None
                ),
            )
            for snapshot in get_xirr_history(session)
        ]
    )


@router.post("/xirr/history/recalculate", status_code=202)
def recalculate_xirr(session: Session = Depends(get_session)) -> dict[str, Any]:
    """Rebuild all XIRR history points from the current entries."""
    points = recalculate_xirr_history(session)
    return {"status": "recalculated", "points": points}


def _percent(value: float | None) -> float | None:
    return round(value * 100, 2) if value is not None else None


@router.get("/returns", response_model=ScopeReturnResponse)
def returns(
    scope: Literal["portfolio", "equity", "gold"] = "portfolio",
    session: Session = Depends(get_session),
) -> ScopeReturnResponse:
    """Return CAGR for long-term scopes and absolute return for short-term ones."""
    summary = get_scope_return(session, scope)
    return ScopeReturnResponse(
        scope=summary.scope,
        metric=summary.metric,
        percent=_percent(summary.percent),
        absolute_percent=_percent(summary.absolute),
        cagr_percent=_percent(summary.cagr),
        period_days=summary.period_days,
    )


@router.get("/xirr", response_model=XirrResponse)
def xirr(
    scope: Literal["portfolio", "equity", "gold"] = "portfolio",
    session: Session = Depends(get_session),
) -> XirrResponse:
    """Return portfolio, equity, or gold XIRR.

    ``portfolio`` includes stocks, mutual funds, physical gold and PPF.
    ``equity`` excludes gold ETFs/funds, and ``gold`` covers only the gold
    sleeve (physical gold + gold ETFs/funds).
    """
    rate = get_portfolio_xirr(session, scope=scope)
    return XirrResponse(
        xirr=rate,
        xirr_percent=round(rate * 100, 2) if rate is not None else None,
    )
