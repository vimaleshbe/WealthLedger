from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.asset_types import AssetType, Category, get_category
from app.core.entry_types import EntryType
from app.core.gold import normalize_gold_purity, parse_gold_purity


class AssetBase(BaseModel):
    name: str = Field(..., min_length=1)
    asset_type: AssetType
    symbol: str | None = None
    details: dict | None = None
    notes: str | None = None


class AssetWriteBase(AssetBase):
    @model_validator(mode="after")
    def validate_gold_purity(self) -> "AssetWriteBase":
        if self.asset_type == AssetType.PHYSICAL_GOLD:
            purity = parse_gold_purity((self.details or {}).get("purity"))
            if purity is None:
                raise ValueError(
                    "Physical gold requires details.purity to be '22k' or '24k'."
                )
            self.details = {**(self.details or {}), "purity": purity.value}
        return self


class AssetCreate(AssetWriteBase):
    initial_date: str | None = None
    initial_value: float | None = Field(default=None, gt=0)
    initial_units: float | None = Field(default=None, gt=0)
    initial_cash_value: float | None = Field(default=None, gt=0)
    initial_entry_details: dict | None = None


class AssetUpdate(AssetWriteBase):
    pass


class AssetRead(AssetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: Category
    gold_purity: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def normalize_category(self) -> "AssetRead":
        # Older rows may still have retirement/commodities categories.
        self.category = get_category(self.asset_type)
        if self.asset_type == AssetType.PHYSICAL_GOLD:
            self.gold_purity = normalize_gold_purity(
                (self.details or {}).get("purity")
            ).value
        return self


class AssetEntryBase(BaseModel):
    date: str
    value: float = Field(..., ge=0)
    units: float = Field(..., gt=0)
    entry_type: EntryType = EntryType.BUY
    affects_cash: bool = False
    cash_value: float | None = Field(default=None, gt=0)
    details: dict | None = None
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


class CashMovementCreate(BaseModel):
    date: str
    value: float = Field(..., gt=0)
    notes: str | None = None


class CashSummary(BaseModel):
    asset_id: int
    balance: float
    total_deposits: float
    total_withdrawals: float
    total_buys: float
    total_sells: float
    currency: str = "INR"
    last_updated: datetime


class PortfolioSummary(BaseModel):
    total_value: float
    portfolio_value: float
    net_worth: float
    cash_value: float
    retirement_value: float = 0.0
    cash_asset_id: int | None = None
    currency: str = "INR"
    asset_count: int
    last_updated: datetime


class AllocationItem(BaseModel):
    asset_id: int | None = None
    name: str | None = None
    category: str | None = None
    asset_type: str | None = None
    value: float
    percentage: float


class AllocationResponse(BaseModel):
    by_asset: list[AllocationItem]
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
    price_unit: str | None = None
    gold_purity: str | None = None


class FDRead(BaseModel):
    asset_id: int
    name: str
    principal: float
    interest: float
    withdrawals: float
    balance: float
    invested_value: float
    interest_rate: float | None = None
    start_date: str | None = None
    tenure_months: int | None = None
    maturity_date: str | None = None
    days_remaining: int | None = None
    maturity_value: float | None = None
    entry_count: int


class RetirementSummaryRead(BaseModel):
    asset_id: int
    asset_type: str
    balance: float
    invested_value: float
    contributions: float
    employee_total: float
    employer_total: float
    pension_total: float
    interest_total: float
    withdrawal_total: float
    unclassified_total: float
    entry_count: int
    last_contribution_date: str | None = None
    first_contribution_date: str | None = None
    maturity_date: str | None = None
    units: float = 0.0
    latest_nav: float | None = None
    gain: float = 0.0


class RetirementAccountRead(RetirementSummaryRead):
    name: str


class RetirementListRead(BaseModel):
    total_balance: float
    accounts: list[RetirementAccountRead]


class GoldRateItem(BaseModel):
    price_per_gram: float
    source: str
    fetched_at: datetime
    stale: bool


class GoldRatesResponse(BaseModel):
    currency: str = "INR"
    unit: str = "gram"
    region: str = "Tamil Nadu"
    provider: str = "Joyalukkas"
    rates: dict[str, GoldRateItem | None]


class XirrResponse(BaseModel):
    xirr: float | None
    xirr_percent: float | None


class ScopeReturnResponse(BaseModel):
    scope: str
    metric: str
    percent: float | None
    absolute_percent: float | None
    cagr_percent: float | None
    period_days: int | None


class XirrHistoryPoint(BaseModel):
    date: str
    xirr_percent: float | None = None


class XirrHistoryResponse(BaseModel):
    points: list[XirrHistoryPoint]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=512)


class SessionRead(BaseModel):
    username: str
    csrf_token: str
    expires_at: datetime
