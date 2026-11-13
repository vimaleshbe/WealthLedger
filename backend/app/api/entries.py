from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.core.config import settings
from app.core.entry_types import EntryType
from app.core.gold import purity_from_asset
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
from app.services.gold import GoldDetailsError, calculate_gold_purchase
from app.services.snapshots import recalculate_snapshots
from app.services.xirr_history import recalculate_xirr_history

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
    entry_details = dict(data.details) if data.details else None
    value = data.value
    cash_value_override = data.cash_value if data.cash_value is not None else data.value

    if asset.asset_type == AssetType.PHYSICAL_GOLD and not is_cash_asset(asset):
        purity = purity_from_asset(asset).value
        entry_details = entry_details or {}
        entry_details.setdefault("purity", purity)

        if entry_type == EntryType.BUY:
            try:
                breakdown = calculate_gold_purchase(units, entry_details)
            except GoldDetailsError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            if breakdown:
                # The purchase value used by the portfolio is the gold value
                # only. Wastage and GST are paid from cash and recorded for
                # transparency.
                value = breakdown.gold_value
                cash_value_override = breakdown.total_paid
                entry_details = breakdown.as_entry_details()
                entry_details["purity"] = purity
        elif entry_type == EntryType.SELL:
            if "gold_price_per_gram" not in entry_details and units > 0:
                entry_details["gold_price_per_gram"] = round(value / units, 2)
            entry_details.setdefault("gold_value", value)
            entry_details.setdefault(
                "total_paid",
                cash_value_override if cash_value_override is not None else value,
            )

    try:
        validate_entry_date(data.date)
        validate_positive(value, "Value")
        validate_positive(units, "Units")
        if cash_value_override is not None:
            validate_positive(cash_value_override, "Cash value")
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    affects_cash = (
        is_cash_asset(asset) or entry_type == EntryType.SELL or data.affects_cash
    )
    cash_value = cash_value_override if affects_cash else None

    previous_date: str | None = None
    if entry_id:
        entry = session.get(AssetEntry, entry_id)
        if not entry or entry.asset_id != asset_id:
            raise HTTPException(status_code=404, detail="Entry not found")
        previous_date = entry.date
        entry.date = data.date
        entry.value = value
        entry.units = units
        entry.entry_type = entry_type
        entry.affects_cash = affects_cash
        entry.cash_value = cash_value
        entry.details = entry_details
        entry.notes = data.notes
        entry.updated_at = datetime.now(UTC)
    else:
        entry = AssetEntry(
            asset_id=asset_id,
            date=data.date,
            value=value,
            units=units,
            entry_type=entry_type,
            affects_cash=affects_cash,
            cash_value=cash_value,
            details=entry_details,
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

    # XIRR history points before today embed the old entry data. Rebuild the
    # series when a backdated entry is created, edited, or moved from a past
    # date so the trend chart stays accurate.
    today_iso = date.today().isoformat()
    if (
        settings.environment != "test"
        and not is_cash_asset(asset)
        and (
            data.date < today_iso
            or (previous_date is not None and previous_date < today_iso)
        )
    ):
        recalculate_xirr_history(session)

    return entry


@router.get("/assets/{asset_id}/entries", response_model=list[AssetEntryRead])
def list_entries(
    asset_id: int, session: Session = Depends(get_session)
) -> list[AssetEntry]:
    if not session.get(Asset, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")
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

    entry_date = entry.date
    entry_asset = session.get(Asset, asset_id)
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

    if (
        settings.environment != "test"
        and entry_asset is not None
        and not is_cash_asset(entry_asset)
        and entry_date < date.today().isoformat()
    ):
        recalculate_xirr_history(session)
