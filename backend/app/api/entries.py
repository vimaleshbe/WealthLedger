from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.entry_types import EntryType
from app.core.validators import ValidationError, validate_entry_date, validate_positive
from app.db import get_session
from app.models import Asset, AssetEntry
from app.schemas import AssetEntryCreate, AssetEntryRead, AssetEntryUpdate
from app.services.cash import (
    is_cash_asset,
    recalculate_asset_cost_basis,
    validate_asset_holdings,
    validate_cash_balance,
)
from app.services.snapshots import recalculate_snapshots

router = APIRouter(tags=["entries"])


def _product_entry_types(asset: Asset) -> tuple[EntryType, ...]:
    if is_cash_asset(asset):
        return (EntryType.DEPOSIT, EntryType.WITHDRAWAL)
    return (EntryType.BUY, EntryType.SELL)


def _upsert_entry(
    session: Session, asset_id: int, data: AssetEntryCreate, entry_id: int | None = None
) -> AssetEntry:
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    try:
        validate_entry_date(data.date)
        validate_positive(data.value, "Value")
        validate_positive(data.units, "Units")
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    allowed_types = _product_entry_types(asset)
    if data.entry_type not in allowed_types:
        label = "Cash entries" if is_cash_asset(asset) else "Asset entries"
        allowed = " or ".join(entry_type.value for entry_type in allowed_types)
        raise HTTPException(
            status_code=422,
            detail=f"{label} must be a {allowed}.",
        )

    entry_type = data.entry_type
    units = 1.0 if is_cash_asset(asset) else data.units
    affects_cash = (
        is_cash_asset(asset) or entry_type == EntryType.SELL or data.affects_cash
    )
    cash_value = data.value if affects_cash else None

    if entry_id:
        entry = session.get(AssetEntry, entry_id)
        if not entry or entry.asset_id != asset_id:
            raise HTTPException(status_code=404, detail="Entry not found")
        entry.date = data.date
        entry.value = data.value
        entry.units = units
        entry.entry_type = entry_type
        entry.affects_cash = affects_cash
        entry.cash_value = cash_value
        entry.notes = data.notes
        entry.updated_at = datetime.now(UTC)
    else:
        entry = AssetEntry(
            asset_id=asset_id,
            date=data.date,
            value=data.value,
            units=units,
            entry_type=entry_type,
            affects_cash=affects_cash,
            cash_value=cash_value,
            notes=data.notes,
        )
        session.add(entry)

    session.flush()

    holding_error = validate_asset_holdings(session, asset_id)
    if holding_error:
        session.rollback()
        raise HTTPException(status_code=422, detail=holding_error)

    cash_error = validate_cash_balance(session)
    if cash_error:
        session.rollback()
        raise HTTPException(status_code=422, detail=cash_error)

    recalculate_asset_cost_basis(session, asset_id)
    session.commit()
    session.refresh(entry)
    recalculate_snapshots(session)
    return entry


@router.get("/assets/{asset_id}/entries", response_model=list[AssetEntryRead])
def list_entries(
    asset_id: int, session: Session = Depends(get_session)
) -> list[AssetEntry]:
    return session.exec(
        select(AssetEntry)
        .where(AssetEntry.asset_id == asset_id)
        .order_by(AssetEntry.date.desc(), AssetEntry.id.desc())
    ).all()


@router.post(
    "/assets/{asset_id}/entries", response_model=AssetEntryRead, status_code=201
)
def create_entry(
    asset_id: int, data: AssetEntryCreate, session: Session = Depends(get_session)
) -> AssetEntry:
    return _upsert_entry(session, asset_id, data)


@router.put("/assets/{asset_id}/entries/{entry_id}", response_model=AssetEntryRead)
def update_entry(
    asset_id: int,
    entry_id: int,
    data: AssetEntryUpdate,
    session: Session = Depends(get_session),
) -> AssetEntry:
    return _upsert_entry(session, asset_id, data, entry_id)


@router.delete("/assets/{asset_id}/entries/{entry_id}", status_code=204)
def delete_entry(
    asset_id: int, entry_id: int, session: Session = Depends(get_session)
) -> None:
    entry = session.get(AssetEntry, entry_id)
    if not entry or entry.asset_id != asset_id:
        raise HTTPException(status_code=404, detail="Entry not found")

    session.delete(entry)
    session.flush()

    holding_error = validate_asset_holdings(session, asset_id)
    if holding_error:
        session.rollback()
        raise HTTPException(status_code=422, detail=holding_error)

    cash_error = validate_cash_balance(session)
    if cash_error:
        session.rollback()
        raise HTTPException(status_code=422, detail=cash_error)

    recalculate_asset_cost_basis(session, asset_id)
    session.commit()
    recalculate_snapshots(session)
