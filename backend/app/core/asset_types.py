from enum import Enum


class AssetType(str, Enum):
    STOCK = "stock"
    MUTUAL_FUND = "mutual_fund"
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
    RETIREMENT = "retirement"
    CASH = "cash"
    REAL_ESTATE = "real_estate"
    COMMODITIES = "commodities"


ASSET_TYPE_CATEGORIES: dict[AssetType, Category] = {
    AssetType.STOCK: Category.EQUITY,
    AssetType.MUTUAL_FUND: Category.EQUITY,
    AssetType.NPS: Category.RETIREMENT,
    AssetType.PPF: Category.RETIREMENT,
    AssetType.CASH: Category.CASH,
    AssetType.BANK_BALANCE: Category.CASH,
    AssetType.PF: Category.RETIREMENT,
    AssetType.PHYSICAL_GOLD: Category.COMMODITIES,
    AssetType.REAL_ESTATE: Category.REAL_ESTATE,
}


def get_category(asset_type: AssetType) -> Category:
    return ASSET_TYPE_CATEGORIES.get(asset_type, Category.EQUITY)
