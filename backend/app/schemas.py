from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.asset_types import AssetType, Category


class AssetBase(BaseModel):
    name: str = Field(..., min_length=1)
    asset_type: AssetType
    symbol: str | None = None
    details: dict | None = None
    notes: str | None = None


class AssetCreate(AssetBase):
    initial_date: str | None = None
    initial_value: float | None = Field(default=None, gt=0)
    initial_units: float | None = Field(default=None, gt=0)


class AssetUpdate(AssetBase):
    pass


class AssetRead(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: Category
    created_at: datetime
    updated_at: datetime


class AssetEntryBase(BaseModel):
    date: str
    value: float = Field(..., gt=0)
    units: float = Field(..., gt=0)
    notes: str | None = None


class AssetEntryCreate(AssetEntryBase):
    pass


class AssetEntryUpdate(AssetEntryBase):
    pass


class AssetEntryRead(AssetEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    created_at: datetime
    updated_at: datetime


class PortfolioSummary(BaseModel):
    total_value: float
    portfolio_value: float
    net_worth: float
    currency: str = "INR"
    asset_count: int
    last_updated: datetime


class AllocationItem(BaseModel):
    category: str | None = None
    asset_type: str | None = None
    value: float
    percentage: float


class AllocationResponse(BaseModel):
    by_category: list[AllocationItem]
    by_asset_type: list[AllocationItem]


class TrendPoint(BaseModel):
    date: str
    total_value: float


class TrendResponse(BaseModel):
    currency: str = "INR"
    points: list[TrendPoint]


class AssetValuation(BaseModel):
    asset_id: int
    invested_value: float
    current_value: float
    change: float
    change_percent: float
    total_units: float
    latest_price: float | None = None
    price_source: str | None = None
    price_fetched_at: datetime | None = None


class XirrResponse(BaseModel):
    xirr: float | None
    xirr_percent: float | None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=512)


class SessionRead(BaseModel):
    username: str
    csrf_token: str
    expires_at: datetime
