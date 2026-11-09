from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.validators import ValidationError, validate_entry_date, validate_positive
from app.db import get_session
from app.models import Asset, AssetEntry
from app.schemas import AssetEntryCreate, AssetEntryRead, AssetEntryUpdate
from app.services.snapshots import recalculate_snapshots

router = APIRouter(tags=["entries"])


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

    existing = session.exec(
        select(AssetEntry).where(
            AssetEntry.asset_id == asset_id, AssetEntry.date == data.date
        )
    ).first()

    if entry_id:
        entry = session.get(AssetEntry, entry_id)
        if not entry or entry.asset_id != asset_id:
            raise HTTPException(status_code=404, detail="Entry not found")
        entry.date = data.date
        entry.value = data.value
        entry.units = data.units
        entry.notes = data.notes
        entry.updated_at = datetime.now(UTC)
    elif existing:
        existing.value = data.value
        existing.units = data.units
        existing.notes = data.notes
        existing.updated_at = datetime.now(UTC)
        entry = existing
    else:
        entry = AssetEntry(
            asset_id=asset_id,
            date=data.date,
            value=data.value,
            units=data.units,
            notes=data.notes,
        )
        session.add(entry)

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
        .order_by(AssetEntry.date.desc())
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
    session.commit()
    recalculate_snapshots(session)
