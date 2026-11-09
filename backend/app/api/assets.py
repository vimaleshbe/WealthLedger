from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.entries import _upsert_entry
from app.core.asset_types import get_category
from app.db import get_session
from app.models import Asset, AssetEntry, MarketDataCache
from app.schemas import (
    AssetCreate,
    AssetEntryCreate,
    AssetRead,
    AssetUpdate,
    AssetValuation,
)

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead])
def list_assets(session: Session = Depends(get_session)) -> list[Asset]:
    return session.exec(select(Asset)).all()


@router.post("", response_model=AssetRead, status_code=201)
def create_asset(data: AssetCreate, session: Session = Depends(get_session)) -> Asset:
    asset = Asset(
        name=data.name,
        asset_type=data.asset_type,
        category=get_category(data.asset_type),
        symbol=data.symbol,
        details=data.details,
        notes=data.notes,
    )
    session.add(asset)
    session.commit()
    session.refresh(asset)

    if data.initial_date and data.initial_value and data.initial_units:
        _upsert_entry(
            session,
            asset.id,
            AssetEntryCreate(
                date=data.initial_date,
                value=data.initial_value,
                units=data.initial_units,
            ),
        )

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

    entries = session.exec(
        select(AssetEntry).where(AssetEntry.asset_id == asset_id)
    ).all()
    invested_value = sum(entry.value for entry in entries)
    total_units = sum(entry.units for entry in entries)

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
    session.exec(AssetEntry.__table__.delete().where(AssetEntry.asset_id == asset_id))
    session.delete(asset)
    session.commit()
