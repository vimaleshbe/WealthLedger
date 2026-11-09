from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.entries import _upsert_entry
from app.core.asset_types import AssetType, get_category
from app.core.entry_types import EntryType
from app.db import get_session
from app.models import Asset, AssetEntry, MarketDataCache
from app.schemas import (
    AssetCreate,
    AssetEntryCreate,
    AssetRead,
    AssetUpdate,
    AssetValuation,
)
from app.services.cash import (
    get_asset_invested_value,
    get_asset_units,
    get_cash_summary,
    is_cash_asset,
    validate_cash_balance,
)
from app.services.snapshots import recalculate_snapshots

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
def list_assets(session: Session = Depends(get_session)) -> list[Asset]:
    return session.exec(select(Asset)).all()


@router.post("", response_model=AssetRead, status_code=201)
def create_asset(data: AssetCreate, session: Session = Depends(get_session)) -> Asset:
    if data.asset_type == AssetType.CASH:
        raise HTTPException(
            status_code=400,
            detail="Cash is managed automatically. Use the cash page to add money.",
        )

    asset = Asset(
        name=data.name,
        asset_type=data.asset_type,
        category=get_category(data.asset_type),
        symbol=data.symbol,
        details=data.details,
        notes=data.notes,
    )
    session.add(asset)
    session.flush()

    if data.initial_date and data.initial_value and data.initial_units:
        _upsert_entry(
            session,
            asset.id,
            AssetEntryCreate(
                date=data.initial_date,
                value=data.initial_value,
                units=data.initial_units,
                entry_type=EntryType.BUY,
                affects_cash=True,
            ),
        )
    else:
        session.commit()

    session.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset(asset_id: int, session: Session = Depends(get_session)) -> Asset:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/{asset_id}/valuation", response_model=AssetValuation)
def get_asset_valuation(
    asset_id: int, session: Session = Depends(get_session)
) -> AssetValuation:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if is_cash_asset(asset):
        summary = get_cash_summary(session)
        invested = summary["total_deposits"]
        current = summary["balance"]
        change = current - invested
        return AssetValuation(
            asset_id=asset.id,
            invested_value=invested,
            current_value=current,
            change=round(change, 2),
            change_percent=(round((change / invested) * 100, 2) if invested else 0.0),
            total_units=0.0,
            latest_price=None,
            price_source=None,
            price_fetched_at=None,
        )

    invested_value = get_asset_invested_value(session, asset_id)
    total_units = get_asset_units(session, asset_id)

    cache = None
    if asset.symbol:
        cache = session.exec(
            select(MarketDataCache).where(
                MarketDataCache.asset_type == asset.asset_type,
                MarketDataCache.symbol == asset.symbol,
            )
        ).first()

    latest_price = cache.price if cache else None
    current_value = (
        round(total_units * latest_price, 2) if latest_price else invested_value
    )
    change = current_value - invested_value
    change_percent = (
        round((change / invested_value) * 100, 2) if invested_value else 0.0
    )

    return AssetValuation(
        asset_id=asset.id,
        invested_value=round(invested_value, 2),
        current_value=round(current_value, 2),
        change=round(change, 2),
        change_percent=change_percent,
        total_units=round(total_units, 4),
        latest_price=latest_price,
        price_source=cache.source if cache else None,
        price_fetched_at=cache.fetched_at if cache else None,
    )


@router.put("/{asset_id}", response_model=AssetRead)
def update_asset(
    asset_id: int, data: AssetUpdate, session: Session = Depends(get_session)
) -> Asset:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if is_cash_asset(asset) or data.asset_type == AssetType.CASH:
        raise HTTPException(
            status_code=400,
            detail="Cash is managed automatically and cannot be edited as an asset.",
        )
    asset.name = data.name
    asset.asset_type = data.asset_type
    asset.category = get_category(data.asset_type)
    asset.symbol = data.symbol
    asset.details = data.details
    asset.notes = data.notes
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, session: Session = Depends(get_session)) -> None:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if is_cash_asset(asset):
        raise HTTPException(status_code=400, detail="Cash cannot be deleted.")

    session.exec(AssetEntry.__table__.delete().where(AssetEntry.asset_id == asset_id))
    session.delete(asset)
    session.flush()

    cash_error = validate_cash_balance(session)
    if cash_error:
        session.rollback()
        raise HTTPException(status_code=422, detail=cash_error)

    session.commit()
    recalculate_snapshots(session)
