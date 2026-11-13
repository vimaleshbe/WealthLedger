from datetime import UTC, date, datetime

import pytest
from sqlmodel import Session

from app.core.asset_types import AssetType
from app.db import engine
from app.models import MarketDataCache
from app.services.gold_rates import fetch_joyalukkas_gold_rates

API = "/api/v1"


def _deposit(client, value: float = 200_000) -> None:
    response = client.post(
        f"{API}/cash/deposit",
        json={"date": "2026-01-01", "value": value},
    )
    assert response.status_code == 201, response.text


def _create_gold(client, purity: str = "22k", **extra) -> dict:
    payload = {
        "name": f"Gold {purity}",
        "asset_type": "physical_gold",
        "details": {"purity": purity},
        **extra,
    }
    response = client.post(f"{API}/assets", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _add_gold_buy(
    client,
    asset_id: int,
    *,
    grams: float = 10,
    rate: float = 12_815,
    wastage: float = 8,
    gst: float = 3,
) -> dict:
    response = client.post(
        f"{API}/assets/{asset_id}/entries",
        json={
            "date": "2026-02-01",
            "value": 1,
            "units": grams,
            "entry_type": "buy",
            "affects_cash": True,
            "cash_value": 1,
            "details": {
                "gold_price_per_gram": rate,
                "wastage_percent": wastage,
                "gst_percent": gst,
            },
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_physical_gold_requires_22k_or_24k(clean_database):
    response = clean_database.post(
        f"{API}/assets",
        json={"name": "Unmarked gold", "asset_type": "physical_gold"},
    )
    assert response.status_code == 422

    gold = _create_gold(clean_database, "24k")
    assert gold["gold_purity"] == "24k"
    assert gold["details"]["purity"] == "24k"


def test_gold_rates_endpoint_fetches_and_caches(clean_database, monkeypatch):
    calls: list[int] = []

    def fake_fetch():
        calls.append(1)
        return {
            "rates": {"22k": 12_815.0, "24k": 13_980.0},
            "rate_time": "2026-11-12 12:51:05",
            "branch": "ONLINE SHOP BANGALORE",
            "source": "Joyalukkas",
        }

    monkeypatch.setattr(
        "app.services.gold_rates.fetch_joyalukkas_gold_rates", fake_fetch
    )

    response = clean_database.get(f"{API}/gold/rates")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["provider"] == "Joyalukkas"
    assert payload["region"] == "Tamil Nadu"
    assert payload["unit"] == "gram"
    assert payload["rates"]["22k"]["price_per_gram"] == 12_815.0
    assert payload["rates"]["24k"]["price_per_gram"] == 13_980.0
    assert payload["rates"]["22k"]["source"] == "Joyalukkas"
    assert len(calls) == 1

    # A normal view reuses the cached rates.
    response = clean_database.get(f"{API}/gold/rates")
    assert response.status_code == 200
    assert len(calls) == 1


def test_joyalukkas_parser_reads_both_purities(monkeypatch):
    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "data": {
                    "getgoldrates": {
                        "Status": 200,
                        "metal_rate_time": "2026-11-12 12:51:05",
                        "Data": [
                            {
                                "BRANCH_CODE": "ECM",
                                "BRANCH_NAME": "ONLINE SHOP BANGALORE",
                                "GOLD_22KT_RATE": "12815",
                                "GOLD_24KT_RATE": "13980",
                            }
                        ],
                    }
                }
            }

    def fake_get(url, **kwargs):
        assert url == "https://www.joyalukkas.in/graphql"
        assert kwargs["params"]["query"].lstrip().startswith("query getgoldrates")
        return FakeResponse()

    monkeypatch.setattr("app.services.gold_rates.httpx.get", fake_get)
    snapshot = fetch_joyalukkas_gold_rates()
    assert snapshot["rates"] == {"22k": 12_815.0, "24k": 13_980.0}
    assert snapshot["source"] == "Joyalukkas"


def test_gold_purchase_counts_only_metal_value(clean_database):
    client = clean_database
    _deposit(client, 200_000)
    gold = _create_gold(client, "22k")

    entry = _add_gold_buy(client, gold["id"])
    assert entry["value"] == 128_150.0
    assert entry["cash_value"] == 142_554.06
    assert entry["units"] == 10
    assert entry["details"]["gold_value"] == 128_150.0
    assert entry["details"]["wastage_amount"] == 10_252.0
    assert entry["details"]["gst_amount"] == 4_152.06
    assert entry["details"]["total_paid"] == 142_554.06

    cash = client.get(f"{API}/cash").json()
    assert cash["balance"] == 57_445.94
    assert cash["total_buys"] == 142_554.06

    valuation = client.get(f"{API}/assets/{gold['id']}/valuation").json()
    assert valuation["invested_value"] == 128_150.0
    assert valuation["current_value"] == 128_150.0
    assert valuation["total_units"] == 10
    assert valuation["price_unit"] == "gram"
    assert valuation["gold_purity"] == "22k"

    allocation = client.get(f"{API}/dashboard/allocation").json()
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category["gold"] == 128_150.0


def test_gold_valuation_uses_purity_rate_times_grams(clean_database):
    client = clean_database
    _deposit(client, 200_000)
    gold = _create_gold(
        client,
        "24k",
        initial_date="2026-01-10",
        initial_value=130_000,
        initial_units=10,
        initial_cash_value=130_000,
        initial_entry_details={
            "gold_price_per_gram": 13_000,
            "wastage_percent": 0,
            "gst_percent": 0,
        },
    )

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.PHYSICAL_GOLD,
                symbol="GOLD_24K",
                price=14_000,
                source="Joyalukkas",
                fetched_at=datetime.now(UTC),
            )
        )
        session.commit()

    valuation = client.get(f"{API}/assets/{gold['id']}/valuation").json()
    assert valuation["invested_value"] == 130_000.0
    assert valuation["current_value"] == 140_000.0
    assert valuation["latest_price"] == 14_000.0
    assert valuation["total_units"] == 10
    assert valuation["price_unit"] == "gram"
    assert valuation["gold_purity"] == "24k"

    allocation = client.get(f"{API}/dashboard/allocation").json()
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category["gold"] == 140_000.0

    # XIRR includes physical gold, using the full invoice amount as the
    # outflow and the cached rate × grams as the current value.
    days = (date.today() - date(2026, 1, 10)).days
    expected_xirr = (140_000.0 / 130_000.0) ** (365.0 / days) - 1
    xirr = client.get(f"{API}/dashboard/xirr").json()
    assert xirr["xirr"] == pytest.approx(expected_xirr, abs=1e-6)
    assert xirr["xirr_percent"] == pytest.approx(
        round(expected_xirr * 100, 2), abs=0.01
    )


def test_gold_initial_holding_uses_invoice_total_for_cash(clean_database):
    client = clean_database
    _deposit(client, 200_000)
    gold = _create_gold(
        client,
        "22k",
        initial_date="2026-01-10",
        initial_value=128_150,
        initial_units=10,
        initial_cash_value=142_554.06,
        initial_entry_details={
            "gold_price_per_gram": 12_815,
            "wastage_percent": 8,
            "gst_percent": 3,
        },
    )

    cash = client.get(f"{API}/cash").json()
    assert cash["balance"] == 57_445.94

    valuation = client.get(f"{API}/assets/{gold['id']}/valuation").json()
    assert valuation["invested_value"] == 128_150.0
    assert valuation["current_value"] == 128_150.0


def test_gold_sale_uses_sale_proceeds_for_cash(clean_database):
    client = clean_database
    _deposit(client, 200_000)
    gold = _create_gold(client, "22k")
    _add_gold_buy(client, gold["id"])

    response = client.post(
        f"{API}/assets/{gold['id']}/entries",
        json={
            "date": "2026-03-01",
            "value": 70_000,
            "units": 5,
            "entry_type": "sell",
            "affects_cash": True,
            "details": {"gold_price_per_gram": 14_000},
        },
    )
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["value"] == 64_075.0
    assert sale["cash_value"] == 70_000.0
    assert sale["details"]["gold_price_per_gram"] == 14_000.0

    cash = client.get(f"{API}/cash").json()
    assert cash["balance"] == 127_445.94
