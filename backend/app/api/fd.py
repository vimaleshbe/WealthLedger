from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.db import get_session
from app.models import Asset
from app.schemas import FDRead
from app.services.fd import get_fd_summary, is_fd_asset

router = APIRouter(prefix="/fd", tags=["fd"])


@router.get("", response_model=list[FDRead])
def list_fds(session: Session = Depends(get_session)) -> list[FDRead]:
    assets = session.exec(
        select(Asset)
        .where(Asset.asset_type == AssetType.FIXED_DEPOSIT)
        .order_by(Asset.id)
    ).all()
    return [
        FDRead(**asdict(get_fd_summary(session, asset.id)))
        for asset in assets
        if asset.id is not None
    ]


@router.get("/{asset_id}/summary", response_model=FDRead)
def fd_summary(asset_id: int, session: Session = Depends(get_session)) -> FDRead:
    asset = session.get(Asset, asset_id)
    if not is_fd_asset(asset):
        raise HTTPException(status_code=404, detail="Fixed deposit not found")
    return FDRead(**asdict(get_fd_summary(session, asset_id)))
