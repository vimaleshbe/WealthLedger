from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import Asset, AssetEntry, PortfolioSnapshot
from app.schemas import (
    AllocationItem,
    AllocationResponse,
    PortfolioSummary,
    TrendPoint,
    TrendResponse,
    XirrResponse,
)
from app.services.xirr import get_portfolio_xirr

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _total_entry_value(session: Session, asset_id: int) -> float:
    """Return the sum of all entry values for an asset (SIP accumulation)."""
    entries = session.exec(
        select(AssetEntry).where(AssetEntry.asset_id == asset_id)
    ).all()
    return sum(entry.value for entry in entries)


PORTFOLIO_ASSET_TYPES = {"stock", "mutual_fund", "ppf"}


@router.get("/summary", response_model=PortfolioSummary)
def summary(session: Session = Depends(get_session)) -> PortfolioSummary:
    assets = session.exec(select(Asset)).all()
    net_worth = sum(_total_entry_value(session, asset.id) for asset in assets)
    portfolio_value = sum(
        _total_entry_value(session, asset.id)
        for asset in assets
        if asset.asset_type.value in PORTFOLIO_ASSET_TYPES
    )
    return PortfolioSummary(
        total_value=net_worth,
        portfolio_value=portfolio_value,
        net_worth=net_worth,
        asset_count=len(assets),
        last_updated=datetime.now(UTC),
    )


@router.get("/allocation", response_model=AllocationResponse)
def allocation(session: Session = Depends(get_session)) -> AllocationResponse:
    assets = session.exec(select(Asset)).all()
    category_values: dict[str, float] = {}
    type_values: dict[str, float] = {}
    total = 0.0

    for asset in assets:
        value = _total_entry_value(session, asset.id)
        category_values[asset.category.value] = (
            category_values.get(asset.category.value, 0.0) + value
        )
        type_values[asset.asset_type.value] = (
            type_values.get(asset.asset_type.value, 0.0) + value
        )
        total += value

    def to_items(mapping: dict[str, float], key_name: str) -> list[AllocationItem]:
        return [
            AllocationItem(
                **{key_name: key},
                value=value,
                percentage=round((value / total) * 100, 2) if total else 0.0,
            )
            for key, value in sorted(mapping.items(), key=lambda x: x[1], reverse=True)
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
