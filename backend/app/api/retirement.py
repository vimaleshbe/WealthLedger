from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.models import Asset
from app.schemas import (
    RetirementAccountRead,
    RetirementListRead,
    RetirementSummaryRead,
)
from app.services.retirement import (
    ensure_retirement_accounts,
    get_retirement_summary,
    is_retirement_asset,
)

router = APIRouter(prefix="/retirement", tags=["retirement"])


@router.get("", response_model=RetirementListRead)
def retirement_accounts(
    session: Session = Depends(get_session),
) -> RetirementListRead:
    """Return PF, PPF and NPS accounts, creating missing accounts on first use."""
    assets = ensure_retirement_accounts(session)
    accounts: list[RetirementAccountRead] = []
    total = 0.0

    for asset in assets:
        summary = get_retirement_summary(session, asset.id)
        total += summary.balance
        accounts.append(RetirementAccountRead(name=asset.name, **asdict(summary)))

    return RetirementListRead(
        total_balance=round(total, 2),
        accounts=accounts,
    )


@router.get("/{asset_id}/summary", response_model=RetirementSummaryRead)
def retirement_summary(
    asset_id: int, session: Session = Depends(get_session)
) -> RetirementSummaryRead:
    asset = session.get(Asset, asset_id)
    if not is_retirement_asset(asset):
        raise HTTPException(status_code=404, detail="Retirement account not found")
    return RetirementSummaryRead(**asdict(get_retirement_summary(session, asset_id)))
