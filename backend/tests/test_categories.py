import pytest

from app.core.asset_types import AssetType, Category, get_effective_category

CASES = [
    ("stock", "equity"),
    ("mutual_fund", "equity"),
    ("fixed_deposit", "debt"),
    ("liquid_fund", "debt"),
    ("arbitrage_fund", "debt"),
    ("ppf", "debt"),
    ("pf", "debt"),
    ("nps", "others"),
    ("physical_gold", "gold"),
    ("real_estate", "real_estate"),
    ("bank_balance", "cash"),
]


@pytest.mark.parametrize(("asset_type", "expected_category"), CASES)
def test_asset_category_mapping(auth_client, asset_type, expected_category):
    payload = {
        "name": f"Category {asset_type}",
        "asset_type": asset_type,
    }
    if asset_type == "physical_gold":
        payload["details"] = {"purity": "22k"}

    response = auth_client.post("/api/v1/assets", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["category"] == expected_category


@pytest.mark.parametrize(
    ("asset_type", "name", "symbol", "expected"),
    [
        (
            AssetType.MUTUAL_FUND,
            "UTI Gold ETF Fund of Fund - Direct Plan - Growth",
            "150714",
            Category.GOLD,
        ),
        (
            AssetType.MUTUAL_FUND,
            "HDFC Gold Savings Fund - Direct Plan",
            None,
            Category.GOLD,
        ),
        (AssetType.STOCK, "GOLDBEES", "GOLDBEES.NS", Category.GOLD),
        # "Goldman" must not be mistaken for a gold fund.
        (
            AssetType.MUTUAL_FUND,
            "Goldman Sachs Equity Fund - Direct Plan",
            None,
            Category.EQUITY,
        ),
        (
            AssetType.ARBITRAGE_FUND,
            "JioBlackRock Arbitrage Fund - Direct Plan",
            "154076",
            Category.DEBT,
        ),
    ],
)
def test_effective_category_detects_gold_funds(asset_type, name, symbol, expected):
    assert get_effective_category(asset_type, name, symbol) is expected


def test_gold_fund_appears_in_gold_allocation(clean_database):
    client = clean_database
    created = client.post(
        "/api/v1/assets",
        json={
            "name": "UTI Gold ETF Fund of Fund - Direct Plan - Growth",
            "asset_type": "mutual_fund",
            "symbol": "150714",
        },
    )
    assert created.status_code == 201, created.text
    asset_id = created.json()["id"]

    entry = client.post(
        f"/api/v1/assets/{asset_id}/entries",
        json={
            "date": "2026-06-19",
            "value": 10_000,
            "units": 358.562,
            "entry_type": "buy",
            "affects_cash": False,
        },
    )
    assert entry.status_code == 201, entry.text

    allocation = client.get("/api/v1/dashboard/allocation").json()
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category["gold"] == pytest.approx(10_000)
    assert "equity" not in by_category

    gold_item = next(
        item for item in allocation["by_asset"] if item["asset_id"] == asset_id
    )
    assert gold_item["category"] == "gold"

    # Keep the shared test database clean for other test modules.
    deleted = client.delete(f"/api/v1/assets/{asset_id}")
    assert deleted.status_code == 204
