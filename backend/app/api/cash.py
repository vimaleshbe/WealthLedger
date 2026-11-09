from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.entries import _upsert_entry
from app.core.entry_types import EntryType
from app.db import get_session
from app.schemas import AssetEntryCreate, CashMovementCreate, CashSummary
from app.services.cash import get_cash_summary, get_or_create_cash_asset

router = APIRouter(prefix="/cash", tags=["cash"])


@router.get("", response_model=CashSummary)
def cash_summary(session: Session = Depends(get_session)) -> CashSummary:
    return CashSummary(**get_cash_summary(session))


@router.post("/deposit", response_model=CashSummary, status_code=201)
def deposit_cash(
    data: CashMovementCreate, session: Session = Depends(get_session)
) -> CashSummary:
    asset = get_or_create_cash_asset(session)
    _upsert_entry(
        session,
        asset.id,
        AssetEntryCreate(
            date=data.date,
            value=data.value,
            units=1,
            entry_type=EntryType.DEPOSIT,
            affects_cash=True,
            notes=data.notes,
        ),
    )
    return CashSummary(**get_cash_summary(session))


@router.post("/withdraw", response_model=CashSummary, status_code=201)
def withdraw_cash(
    data: CashMovementCreate, session: Session = Depends(get_session)
) -> CashSummary:
    asset = get_or_create_cash_asset(session)
    _upsert_entry(
        session,
        asset.id,
        AssetEntryCreate(
            date=data.date,
            value=data.value,
            units=1,
            entry_type=EntryType.WITHDRAWAL,
            affects_cash=True,
            notes=data.notes,
        ),
    )
    return CashSummary(**get_cash_summary(session))
