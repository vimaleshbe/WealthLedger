from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.db import get_session
from app.models import Asset, PortfolioSnapshot
from app.schemas import (
    AllocationItem,
    AllocationResponse,
    PortfolioSummary,
    TrendPoint,
    TrendResponse,
    XirrResponse,
)
from app.services.cash import (
    get_asset_invested_value,
    get_cash_balance,
    get_or_create_cash_asset,
    is_cash_asset,
)
from app.services.xirr import get_portfolio_xirr

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


PORTFOLIO_ASSET_TYPES = {
    AssetType.STOCK.value,
    AssetType.MUTUAL_FUND.value,
    AssetType.PPF.value,
}


@router.get("/summary", response_model=PortfolioSummary)
def summary(session: Session = Depends(get_session)) -> PortfolioSummary:
    cash_asset = get_or_create_cash_asset(session)
    assets = [
        asset for asset in session.exec(select(Asset)).all() if not is_cash_asset(asset)
    ]
    cash_value = get_cash_balance(session)

    invested = {
        asset.id: get_asset_invested_value(session, asset.id) for asset in assets
    }
    net_worth = round(sum(invested.values()) + cash_value, 2)
    portfolio_value = round(
        sum(
            invested[asset.id]
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
    total = 0.0

    for asset in assets:
        value = get_asset_invested_value(session, asset.id)
        category_values[asset.category.value] = (
            category_values.get(asset.category.value, 0.0) + value
        )
        type_values[asset.asset_type.value] = (
            type_values.get(asset.asset_type.value, 0.0) + value
        )
        total += value

    cash_value = get_cash_balance(session)
    if cash_value:
        category_values["cash"] = category_values.get("cash", 0.0) + cash_value
        type_values[AssetType.CASH.value] = cash_value
        total += cash_value

    def to_items(mapping: dict[str, float], key_name: str) -> list[AllocationItem]:
        return [
            AllocationItem(
                **{key_name: key},
                value=value,
                percentage=round((value / total) * 100, 2) if total else 0.0,
            )
            for key, value in sorted(mapping.items(), key=lambda x: x[1], reverse=True)
            if value > 0
        ]

    return AllocationResponse(
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


@router.get("/xirr", response_model=XirrResponse)
def xirr(session: Session = Depends(get_session)) -> XirrResponse:
    """Return portfolio XIRR excluding real estate assets."""
    rate = get_portfolio_xirr(session)
    return XirrResponse(
        xirr=rate,
        xirr_percent=round(rate * 100, 2) if rate is not None else None,
    )
