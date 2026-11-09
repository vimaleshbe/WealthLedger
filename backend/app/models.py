from datetime import UTC, datetime

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlmodel import Field, SQLModel

from app.core.asset_types import AssetType, Category, get_category
from app.core.entry_types import EntryType


def now_utc() -> datetime:
    return datetime.now(UTC)


class Asset(SQLModel, table=True):
    __tablename__ = "asset"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    asset_type: AssetType
    category: Category
    symbol: str | None = None
    details: dict | None = Field(default=None, sa_column=Column(JSON))
    notes: str | None = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    def __init__(self, **data):
        if "category" not in data and "asset_type" in data:
            data["category"] = get_category(data["asset_type"])
        super().__init__(**data)


class AssetEntry(SQLModel, table=True):
    __tablename__ = "asset_entry"

    id: int | None = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="asset.id", index=True)
    date: str = Field(index=True)
    value: float = Field(ge=0)
    units: float = Field(gt=0)
    entry_type: EntryType = Field(default=EntryType.BUY)
    # New entries that move money in or out of the cash ledger set this to
    # True. Legacy entries keep it False so the cash balance is not changed
    # retroactively.
    affects_cash: bool = Field(default=False)
    # Actual amount that moved through cash. For a sell this is the sale
    # proceeds, while `value` holds the cost basis of the units sold.
    cash_value: float | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class PortfolioSnapshot(SQLModel, table=True):
    __tablename__ = "portfolio_snapshot"
    __table_args__ = (UniqueConstraint("date", name="uix_snapshot_date"),)

    id: int | None = Field(default=None, primary_key=True)
    date: str = Field(index=True)
    total_value: float = 0.0
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class MarketDataCache(SQLModel, table=True):
    __tablename__ = "market_data_cache"
    __table_args__ = (UniqueConstraint("asset_type", "symbol", name="uix_market_data"),)

    id: int | None = Field(default=None, primary_key=True)
    asset_type: AssetType
    symbol: str
    price: float
    fetched_at: datetime = Field(default_factory=now_utc)
    source: str
    created_at: datetime = Field(default_factory=now_utc)
