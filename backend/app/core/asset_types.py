import re
from enum import Enum


class AssetType(str, Enum):
    STOCK = "stock"
    MUTUAL_FUND = "mutual_fund"
    FIXED_DEPOSIT = "fixed_deposit"
    LIQUID_FUND = "liquid_fund"
    ARBITRAGE_FUND = "arbitrage_fund"
    NPS = "nps"
    PPF = "ppf"
    CASH = "cash"
    BANK_BALANCE = "bank_balance"
    PF = "pf"
    PHYSICAL_GOLD = "physical_gold"
    REAL_ESTATE = "real_estate"


class Category(str, Enum):
    EQUITY = "equity"
    DEBT = "debt"
    CASH = "cash"
    REAL_ESTATE = "real_estate"
    GOLD = "gold"
    OTHERS = "others"
    # Kept for reading older databases; new allocations use the categories
    # above.
    RETIREMENT = "retirement"
    COMMODITIES = "commodities"


ASSET_TYPE_CATEGORIES: dict[AssetType, Category] = {
    AssetType.STOCK: Category.EQUITY,
    AssetType.MUTUAL_FUND: Category.EQUITY,
    AssetType.FIXED_DEPOSIT: Category.DEBT,
    AssetType.LIQUID_FUND: Category.DEBT,
    AssetType.ARBITRAGE_FUND: Category.DEBT,
    AssetType.NPS: Category.OTHERS,
    AssetType.PPF: Category.DEBT,
    AssetType.CASH: Category.CASH,
    AssetType.BANK_BALANCE: Category.CASH,
    AssetType.PF: Category.DEBT,
    AssetType.PHYSICAL_GOLD: Category.GOLD,
    AssetType.REAL_ESTATE: Category.REAL_ESTATE,
}

# Balance accounts that are tracked outside the market portfolio. They count
# in net worth but are presented in the Retirement tab.
RETIREMENT_ASSET_TYPES: frozenset[AssetType] = frozenset(
    {AssetType.PF, AssetType.PPF, AssetType.NPS}
)


def is_retirement_type(asset_type: AssetType) -> bool:
    return asset_type in RETIREMENT_ASSET_TYPES


def get_category(asset_type: AssetType) -> Category:
    return ASSET_TYPE_CATEGORIES.get(asset_type, Category.EQUITY)


# Fund/ETF names that hold the metal directly, e.g. "UTI Gold ETF Fund of
# Fund". The word-boundary match deliberately ignores "Goldman Sachs".
_GOLD_NAME_PATTERN = re.compile(r"\bgold\b", re.IGNORECASE)
_GOLD_SYMBOL_PREFIX = "GOLD"
_GOLD_ELIGIBLE_TYPES = {AssetType.STOCK, AssetType.MUTUAL_FUND}


def is_gold_fund(
    asset_type: AssetType,
    name: str | None = None,
    symbol: str | None = None,
) -> bool:
    """True when a stock/fund invests in gold rather than equity or debt."""
    if asset_type not in _GOLD_ELIGIBLE_TYPES:
        return False
    if name and _GOLD_NAME_PATTERN.search(name):
        return True
    if symbol:
        base = symbol.upper().split(".")[0].replace("-", "")
        return base.startswith(_GOLD_SYMBOL_PREFIX)
    return False


def get_effective_category(
    asset_type: AssetType,
    name: str | None = None,
    symbol: str | None = None,
) -> Category:
    """Category for reporting, including name-based gold fund detection."""
    if is_gold_fund(asset_type, name, symbol):
        return Category.GOLD
    return get_category(asset_type)
