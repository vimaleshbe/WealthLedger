"""Long-horizon scenario audit for WealthLedger.

Every test in this module runs against the throwaway database created by
``conftest.py``. The autouse fixture refuses to clean anything unless the
database URL points at that temporary test directory, so live portfolio data
can never be touched.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from app.core.asset_types import AssetType
from app.db import engine
from app.main import app
from app.models import (
    MarketDataCache,
    XirrSnapshot,
)
from app.services.cagr import get_scope_return
from app.services.xirr import calculate_xirr, get_portfolio_xirr

API = "/api/v1"
TEST_USERNAME = "testuser"
TEST_PASSWORD = "test-password-123"


def _assert_temp_database() -> None:
    url = str(engine.url)
    if "portfolio-tests-" not in url:
        raise RuntimeError(
            f"Refusing to clean a database outside the pytest temp directory: {url}"
        )


def _reset_database() -> None:
    """Delete every row from the isolated test database between scenarios."""
    _assert_temp_database()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        for table in reversed(SQLModel.metadata.sorted_tables):
            session.exec(table.delete())
        session.commit()


@pytest.fixture(autouse=True)
def clean_ledger():
    _reset_database()
    yield
    _reset_database()


def _post(client: TestClient, path: str, payload: dict, expected: int = 201):
    response = client.post(f"{API}{path}", json=payload)
    assert response.status_code == expected, response.text
    return response.json()


def _put(client: TestClient, path: str, payload: dict, expected: int = 200):
    response = client.put(f"{API}{path}", json=payload)
    assert response.status_code == expected, response.text
    return response.json()


def _get(client: TestClient, path: str, expected: int = 200):
    response = client.get(f"{API}{path}")
    assert response.status_code == expected, response.text
    return response.json()


def _create_asset(
    client: TestClient,
    name: str,
    asset_type: str,
    *,
    symbol: str | None = None,
) -> dict:
    payload: dict = {"name": name, "asset_type": asset_type}
    if asset_type == "physical_gold":
        payload["details"] = {"purity": "22k"}
    if symbol:
        payload["symbol"] = symbol
    return _post(client, "/assets", payload)


def _deposit(client: TestClient, day: str, value: float, notes: str = "") -> dict:
    return _post(
        client,
        "/cash/deposit",
        {"date": day, "value": value, "notes": notes or None},
    )


def _withdraw(client: TestClient, day: str, value: float, notes: str = "") -> dict:
    return _post(
        client,
        "/cash/withdraw",
        {"date": day, "value": value, "notes": notes or None},
    )


def _add_entry(
    client: TestClient,
    asset_id: int,
    day: str,
    value: float,
    units: float,
    entry_type: str,
    *,
    affects_cash: bool = True,
    notes: str = "",
) -> dict:
    return _post(
        client,
        f"/assets/{asset_id}/entries",
        {
            "date": day,
            "value": value,
            "units": units,
            "entry_type": entry_type,
            "affects_cash": affects_cash,
            "notes": notes or None,
        },
    )


def _independent_xirr(cashflows: list[tuple[date, float]]) -> float | None:
    """Bisection XIRR, deliberately independent from the app's Newton solver."""
    if len(cashflows) < 2:
        return None
    start = min(day for day, _ in cashflows)

    def npv(rate: float) -> float:
        total = 0.0
        for day, amount in cashflows:
            total += amount / ((1.0 + rate) ** ((day - start).days / 365.0))
        return total

    low, high = -0.999999, 10.0
    npv_low, npv_high = npv(low), npv(high)
    assert npv_low * npv_high <= 0, (npv_low, npv_high)

    for _ in range(200):
        mid = (low + high) / 2
        npv_mid = npv(mid)
        if npv_low * npv_mid <= 0:
            high = mid
            npv_high = npv_mid
        else:
            low = mid
            npv_low = npv_mid
    return (low + high) / 2


def test_multi_year_portfolio_lifecycle(auth_client):
    """Seven years of deposits, SIPs, buys, sales, withdrawals and valuations."""
    cache = {
        "Scenario Blue Chip": 450.0,
        "Scenario Equity MF": 180.0,
    }
    specs = [
        ("Scenario Blue Chip", "stock", "SCEN.NS"),
        ("Scenario Equity MF", "mutual_fund", "MFSCEN"),
        ("Scenario PPF", "ppf", None),
        ("Scenario FD", "fixed_deposit", None),
        ("Scenario Gold", "physical_gold", None),
        ("Scenario NPS", "nps", None),
        ("Scenario Real Estate", "real_estate", None),
    ]
    assets: dict[str, dict] = {}
    for name, asset_type, symbol in specs:
        assets[name] = _create_asset(auth_client, name, asset_type, symbol=symbol)

    operations: list[dict] = []

    def deposit(day: str, value: float) -> None:
        operations.append({"kind": "deposit", "date": day, "value": value})

    def withdraw(day: str, value: float) -> None:
        operations.append({"kind": "withdrawal", "date": day, "value": value})

    def buy(name: str, day: str, value: float, units: float) -> None:
        operations.append(
            {
                "kind": "buy",
                "date": day,
                "asset": name,
                "value": value,
                "units": units,
            }
        )

    def sell(name: str, day: str, proceeds: float, units: float) -> None:
        operations.append(
            {
                "kind": "sell",
                "date": day,
                "asset": name,
                "value": proceeds,
                "units": units,
            }
        )

    deposit("2019-01-01", 500_000)
    for year in range(2019, 2026):
        for month in range(1, 13):
            day = f"{year:04d}-{month:02d}"
            if (year, month) > (2019, 1):
                deposit(f"{day}-01", 60_000)
            if (year, month) >= (2019, 2):
                buy("Scenario Equity MF", f"{day}-05", 10_000, 100)
            if month in (3, 6, 9, 12):
                buy("Scenario Blue Chip", f"{day}-15", 30_000, 100)

        buy("Scenario PPF", f"{year}-04-01", 150_000, 1)
        buy("Scenario FD", f"{year}-05-01", 100_000, 1)
        buy("Scenario Gold", f"{year}-06-01", 25_000, 1)
        buy("Scenario NPS", f"{year}-07-01", 30_000, 1)

        sell("Scenario Blue Chip", f"{year}-12-20", 80_000, 200)
        sell("Scenario Equity MF", f"{year}-12-20", 60_000, 500)

    buy("Scenario Real Estate", "2021-06-15", 750_000, 1)
    for year in range(2020, 2026):
        withdraw(f"{year}-01-05", 50_000)

    operations.sort(key=lambda operation: operation["date"])

    expected = {
        "deposits": 0.0,
        "withdrawals": 0.0,
        "buys": 0.0,
        "sells": 0.0,
        "invested": dict.fromkeys(assets, 0.0),
        "units": dict.fromkeys(assets, 0.0),
        "entry_counts": dict.fromkeys(assets, 0),
        "cash_entries": 0,
        "snapshot_events": {},
        "xirr_flows": [],
    }

    def add_snapshot_event(day: str, amount: float) -> None:
        expected["snapshot_events"][day] = (
            expected["snapshot_events"].get(day, 0.0) + amount
        )

    for operation in operations:
        kind = operation["kind"]
        day = operation["date"]
        if kind == "deposit":
            _deposit(auth_client, day, operation["value"])
            expected["deposits"] += operation["value"]
            expected["cash_entries"] += 1
            add_snapshot_event(day, operation["value"])
        elif kind == "withdrawal":
            _withdraw(auth_client, day, operation["value"])
            expected["withdrawals"] += operation["value"]
            expected["cash_entries"] += 1
            add_snapshot_event(day, -operation["value"])
        elif kind == "buy":
            name = operation["asset"]
            result = _add_entry(
                auth_client,
                assets[name]["id"],
                day,
                operation["value"],
                operation["units"],
                "buy",
            )
            assert result["affects_cash"] is True
            assert result["cash_value"] == pytest.approx(operation["value"])
            expected["buys"] += operation["value"]
            expected["invested"][name] += operation["value"]
            expected["units"][name] += operation["units"]
            expected["entry_counts"][name] += 1
            add_snapshot_event(day, 0.0)
            if name in cache or name in {"Scenario Gold", "Scenario PPF"}:
                expected["xirr_flows"].append(
                    (date.fromisoformat(day), -operation["value"])
                )
        elif kind == "sell":
            name = operation["asset"]
            units_before = expected["units"][name]
            cost_before = expected["invested"][name]
            average_cost = cost_before / units_before
            basis = round(min(operation["units"] * average_cost, cost_before), 2)
            result = _add_entry(
                auth_client,
                assets[name]["id"],
                day,
                operation["value"],
                operation["units"],
                "sell",
            )
            assert result["cash_value"] == pytest.approx(operation["value"])
            assert result["value"] == pytest.approx(basis, abs=0.01)
            expected["sells"] += operation["value"]
            expected["invested"][name] -= basis
            expected["units"][name] -= operation["units"]
            expected["entry_counts"][name] += 1
            add_snapshot_event(day, operation["value"] - basis)
            if name in cache:
                expected["xirr_flows"].append(
                    (date.fromisoformat(day), operation["value"])
                )

    with Session(engine) as session:
        for name, value in cache.items():
            asset = assets[name]
            session.add(
                MarketDataCache(
                    asset_type=AssetType(asset["asset_type"]),
                    symbol=asset["symbol"],
                    price=value,
                    source="scenario-test",
                )
            )
        session.commit()

    cash = _get(auth_client, "/cash")
    expected_cash = round(
        expected["deposits"]
        - expected["withdrawals"]
        - expected["buys"]
        + expected["sells"],
        2,
    )
    assert cash["balance"] == pytest.approx(expected_cash, abs=0.01)
    assert cash["total_deposits"] == pytest.approx(expected["deposits"])
    assert cash["total_withdrawals"] == pytest.approx(expected["withdrawals"])
    assert cash["total_buys"] == pytest.approx(expected["buys"])
    assert cash["total_sells"] == pytest.approx(expected["sells"])

    expected_portfolio = 0.0
    expected_net_worth = expected_cash
    portfolio_types = {
        "stock",
        "mutual_fund",
        "fixed_deposit",
        "liquid_fund",
        "arbitrage_fund",
        "ppf",
    }
    for name, asset in assets.items():
        valuation = _get(auth_client, f"/assets/{asset['id']}/valuation")
        assert valuation["invested_value"] == pytest.approx(
            expected["invested"][name], abs=0.02
        )
        assert valuation["total_units"] == pytest.approx(
            expected["units"][name], abs=1e-6
        )
        expected_net_worth += expected["invested"][name]
        if asset["asset_type"] in portfolio_types:
            expected_portfolio += expected["invested"][name]
        if name in cache:
            assert valuation["latest_price"] == pytest.approx(cache[name])
            assert valuation["current_value"] == pytest.approx(
                round(expected["units"][name] * cache[name], 2), abs=0.01
            )

    summary = _get(auth_client, "/dashboard/summary")
    assert summary["cash_value"] == pytest.approx(expected_cash, abs=0.01)
    assert summary["portfolio_value"] == pytest.approx(expected_portfolio, abs=0.02)
    assert summary["net_worth"] == pytest.approx(expected_net_worth, abs=0.02)
    assert summary["total_value"] == pytest.approx(expected_net_worth, abs=0.02)
    assert summary["asset_count"] == len(assets)
    assert summary["cash_asset_id"] == cash["asset_id"]

    category_values = {
        "equity": sum(
            expected["invested"][name]
            for name, asset in assets.items()
            if asset["asset_type"] in {"stock", "mutual_fund"}
        ),
        "debt": sum(
            expected["invested"][name]
            for name, asset in assets.items()
            if asset["asset_type"] in {"fixed_deposit", "ppf"}
        ),
        "gold": expected["invested"]["Scenario Gold"],
        "others": expected["invested"]["Scenario NPS"],
        "real_estate": expected["invested"]["Scenario Real Estate"],
        "cash": expected_cash,
    }
    allocation = _get(auth_client, "/dashboard/allocation")
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    for category, value in category_values.items():
        assert by_category[category] == pytest.approx(value, abs=0.02)
    assert sum(
        item["percentage"] for item in allocation["by_category"]
    ) == pytest.approx(100.0, abs=0.2)
    assert {item["name"] for item in allocation["by_asset"]} == {
        *assets,
        "Cash",
    }

    trend = _get(auth_client, "/dashboard/trend")
    running = 0.0
    expected_trend = []
    for day in sorted(expected["snapshot_events"]):
        running += expected["snapshot_events"][day]
        expected_trend.append((day, running))
    assert [point["date"] for point in trend["points"]] == [
        day for day, _ in expected_trend
    ]
    for point, (_, value) in zip(trend["points"], expected_trend, strict=True):
        assert point["total_value"] == pytest.approx(value, abs=0.02)
    assert trend["points"][-1]["total_value"] == pytest.approx(
        expected_net_worth, abs=0.02
    )
    assert len(trend["points"]) == len(expected["snapshot_events"])

    xirr_flows = list(expected["xirr_flows"])
    for name in cache:
        xirr_flows.append(
            (
                date.today(),
                round(expected["units"][name] * cache[name], 2),
            )
        )
    # Gold has no cached rate in this scenario, so its current value falls
    # back to its metal cost basis.
    xirr_flows.append((date.today(), expected["invested"]["Scenario Gold"]))
    # PPF is part of portfolio XIRR and has no market price, so it is valued
    # at its contributed cost.
    xirr_flows.append((date.today(), expected["invested"]["Scenario PPF"]))
    expected_xirr = _independent_xirr(xirr_flows)
    assert expected_xirr is not None
    xirr = _get(auth_client, "/dashboard/xirr")
    assert xirr["xirr"] == pytest.approx(expected_xirr, abs=1e-6)
    assert xirr["xirr_percent"] == pytest.approx(
        round(expected_xirr * 100, 2), abs=0.01
    )

    history = _get(auth_client, "/dashboard/xirr/history")["points"]
    today_points = [
        point for point in history if point["date"] == date.today().isoformat()
    ]
    assert len(today_points) == 1
    assert today_points[0]["xirr_percent"] == pytest.approx(
        xirr["xirr_percent"], abs=0.01
    )

    total_entries = 0
    for name, asset in assets.items():
        entries = _get(auth_client, f"/assets/{asset['id']}/entries")
        assert len(entries) == expected["entry_counts"][name]
        assert [entry["date"] for entry in entries] == sorted(
            (entry["date"] for entry in entries), reverse=True
        )
        total_entries += len(entries)
    cash_entries = _get(auth_client, f"/assets/{cash['asset_id']}/entries")
    assert len(cash_entries) == expected["cash_entries"]
    assert total_entries + len(cash_entries) == len(operations)

    active_assets = _get(auth_client, "/assets?include_closed=false")
    assert len(active_assets) == len(assets) + 1  # holdings plus managed cash


def test_known_xirr_values():
    assert calculate_xirr(
        [(date(2021, 1, 1), -1000.0), (date(2022, 1, 1), 2000.0)]
    ) == pytest.approx(1.0, abs=1e-7)
    assert calculate_xirr(
        [(date(2021, 1, 1), -1000.0), (date(2023, 1, 1), 2000.0)]
    ) == pytest.approx(math.sqrt(2) - 1, abs=1e-7)
    assert calculate_xirr(
        [(date(2021, 1, 1), -1000.0), (date(2022, 1, 1), 500.0)]
    ) == pytest.approx(-0.5, abs=1e-7)
    assert calculate_xirr([(date(2021, 1, 1), -1000.0)]) is None


def test_portfolio_xirr_uses_market_value_and_ignores_non_market_assets(
    auth_client,
):
    _deposit(auth_client, "2021-01-01", 1000)
    stock = _create_asset(auth_client, "XIRR Stock", "stock", symbol="XIRR.NS")
    _add_entry(auth_client, stock["id"], "2021-01-01", 1000, 10, "buy")
    _create_asset(auth_client, "XIRR PPF", "ppf")

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.STOCK,
                symbol="XIRR.NS",
                price=200.0,
                source="scenario-test",
            )
        )
        session.commit()
        rate = get_portfolio_xirr(session, as_of=date(2022, 1, 1))

    assert rate == pytest.approx(1.0, abs=1e-7)


def test_xirr_scopes_separate_equity_and_gold(auth_client):
    _deposit(auth_client, "2021-01-01", 3000)
    stock = _create_asset(auth_client, "XIRR Equity", "stock", symbol="XIRREQ.NS")
    _add_entry(auth_client, stock["id"], "2021-01-01", 1000, 10, "buy")
    gold = _create_asset(auth_client, "XIRR Gold", "physical_gold")
    _add_entry(auth_client, gold["id"], "2021-01-01", 1000, 10, "buy")
    gold_fund = _create_asset(
        auth_client,
        "UTI Gold ETF Fund of Fund - Direct Plan - Growth",
        "mutual_fund",
    )
    _add_entry(auth_client, gold_fund["id"], "2021-01-01", 1000, 10, "buy")

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.STOCK,
                symbol="XIRREQ.NS",
                price=200.0,
                source="scenario-test",
            )
        )
        session.commit()
        equity_rate = get_portfolio_xirr(
            session, as_of=date(2022, 1, 1), scope="equity"
        )
        gold_rate = get_portfolio_xirr(session, as_of=date(2022, 1, 1), scope="gold")
        portfolio_rate = get_portfolio_xirr(
            session, as_of=date(2022, 1, 1), scope="portfolio"
        )

    assert equity_rate == pytest.approx(1.0, abs=1e-7)
    assert gold_rate == pytest.approx(0.0, abs=1e-7)
    assert portfolio_rate is not None
    assert portfolio_rate < equity_rate


def test_portfolio_xirr_includes_ppf(auth_client):
    _deposit(auth_client, "2021-01-01", 4000)
    stock = _create_asset(auth_client, "PPF Scope Stock", "stock", symbol="PPFSCOPE.NS")
    _add_entry(auth_client, stock["id"], "2021-01-01", 1000, 10, "buy")
    ppf = _create_asset(auth_client, "PPF Scope Account", "ppf")
    _add_entry(auth_client, ppf["id"], "2021-01-01", 1000, 1, "buy")

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.STOCK,
                symbol="PPFSCOPE.NS",
                price=200.0,
                source="scenario-test",
            )
        )
        session.commit()
        equity_rate = get_portfolio_xirr(
            session, as_of=date(2022, 1, 1), scope="equity"
        )
        portfolio_rate = get_portfolio_xirr(
            session, as_of=date(2022, 1, 1), scope="portfolio"
        )

    assert equity_rate == pytest.approx(1.0, abs=1e-7)
    assert portfolio_rate == pytest.approx(0.5, abs=1e-7)


def test_scope_cagr_uses_market_value(auth_client):
    _deposit(auth_client, "2021-01-01", 3000)
    stock = _create_asset(auth_client, "CAGR Equity", "stock", symbol="CAGREQ.NS")
    _add_entry(auth_client, stock["id"], "2021-01-01", 1000, 10, "buy")
    gold_fund = _create_asset(
        auth_client,
        "HDFC Gold ETF Fund of Fund - Direct Plan",
        "mutual_fund",
    )
    _add_entry(auth_client, gold_fund["id"], "2021-01-01", 1000, 10, "buy")

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.STOCK,
                symbol="CAGREQ.NS",
                price=200.0,
                source="scenario-test",
            )
        )
        session.commit()
        equity_return = get_scope_return(session, scope="equity")
        gold_return = get_scope_return(session, scope="gold")
        portfolio_return = get_scope_return(session, scope="portfolio")

    years = (date.today() - date(2021, 1, 1)).days / 365.25
    expected_equity = 2 ** (1 / years) - 1
    assert equity_return.metric == "cagr"
    assert equity_return.percent == pytest.approx(expected_equity, abs=1e-7)
    # The gold fund has no cached price, so it is valued at cost.
    assert gold_return.metric == "cagr"
    assert gold_return.percent == pytest.approx(0.0, abs=1e-7)
    assert portfolio_return.percent is not None
    assert portfolio_return.percent < equity_return.percent


def test_short_holding_uses_absolute_return(auth_client):
    purchase_day = date.today() - timedelta(days=100)
    _deposit(auth_client, purchase_day.isoformat(), 1000)
    stock = _create_asset(auth_client, "Short Hold Stock", "stock", symbol="SHORT.NS")
    _add_entry(
        auth_client,
        stock["id"],
        purchase_day.isoformat(),
        1000,
        10,
        "buy",
    )

    with Session(engine) as session:
        session.add(
            MarketDataCache(
                asset_type=AssetType.STOCK,
                symbol="SHORT.NS",
                price=200.0,
                source="scenario-test",
            )
        )
        session.commit()
        summary = get_scope_return(session, scope="equity")

    assert summary.metric == "absolute"
    assert summary.period_days == 100
    assert summary.percent == pytest.approx(1.0, abs=1e-7)
    assert summary.cagr is not None
    assert summary.cagr > summary.percent


def test_backdated_edit_delete_recalculates_cost_basis_cash_and_snapshots(
    auth_client,
):
    _deposit(auth_client, "2020-01-01", 10_000)
    stock = _create_asset(auth_client, "Backdated Stock", "stock")
    asset_id = stock["id"]

    buy_one = _add_entry(auth_client, asset_id, "2020-01-10", 1000, 10, "buy")
    buy_two = _add_entry(auth_client, asset_id, "2020-02-10", 2000, 10, "buy")
    sale = _add_entry(auth_client, asset_id, "2020-03-10", 1500, 5, "sell")

    assert sale["value"] == pytest.approx(750.0)
    assert sale["cash_value"] == pytest.approx(1500.0)
    valuation = _get(auth_client, f"/assets/{asset_id}/valuation")
    assert valuation["invested_value"] == pytest.approx(2250.0)
    assert valuation["total_units"] == pytest.approx(15.0)
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(8500.0)

    updated_buy = _put(
        auth_client,
        f"/assets/{asset_id}/entries/{buy_one['id']}",
        {
            "date": "2020-01-10",
            "value": 2000,
            "units": 20,
            "entry_type": "buy",
            "affects_cash": True,
        },
    )
    assert updated_buy["cash_value"] == pytest.approx(2000.0)
    valuation = _get(auth_client, f"/assets/{asset_id}/valuation")
    assert valuation["invested_value"] == pytest.approx(3333.33, abs=0.01)
    assert valuation["total_units"] == pytest.approx(25.0)
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(7500.0)

    sale_after_edit = _get(auth_client, f"/assets/{asset_id}/entries")[0]
    assert sale_after_edit["id"] == sale["id"]
    assert sale_after_edit["value"] == pytest.approx(666.67, abs=0.01)
    assert sale_after_edit["cash_value"] == pytest.approx(1500.0)

    trend = _get(auth_client, "/dashboard/trend")["points"]
    assert trend[-1]["total_value"] == pytest.approx(10_833.33, abs=0.02)

    delete = auth_client.delete(f"{API}/assets/{asset_id}/entries/{buy_one['id']}")
    assert delete.status_code == 204, delete.text
    valuation = _get(auth_client, f"/assets/{asset_id}/valuation")
    assert valuation["invested_value"] == pytest.approx(1000.0)
    assert valuation["total_units"] == pytest.approx(5.0)
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(9500.0)
    trend = _get(auth_client, "/dashboard/trend")["points"]
    assert trend[-1]["total_value"] == pytest.approx(10_500.0, abs=0.02)

    blocked = auth_client.delete(f"{API}/assets/{asset_id}/entries/{buy_two['id']}")
    assert blocked.status_code == 422
    assert "more units" in blocked.json()["detail"]
    entries = _get(auth_client, f"/assets/{asset_id}/entries")
    assert len(entries) == 2
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(9500.0)


def test_same_day_buy_and_sell_are_allowed_in_order(auth_client):
    _deposit(auth_client, "2024-01-01", 10_000)
    stock = _create_asset(auth_client, "Same Day Stock", "stock")
    _add_entry(auth_client, stock["id"], "2024-01-02", 10_000, 10, "buy")
    sale = _add_entry(auth_client, stock["id"], "2024-01-02", 6000, 5, "sell")

    assert sale["value"] == pytest.approx(5000.0)
    assert sale["cash_value"] == pytest.approx(6000.0)
    valuation = _get(auth_client, f"/assets/{stock['id']}/valuation")
    assert valuation["total_units"] == pytest.approx(5.0)
    assert valuation["invested_value"] == pytest.approx(5000.0)
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(6000.0)


def test_deleting_a_cash_source_that_would_overdraw_is_rejected(auth_client):
    _deposit(auth_client, "2024-01-01", 10_000)
    stock = _create_asset(auth_client, "Funded Stock", "stock")
    _add_entry(auth_client, stock["id"], "2024-01-02", 10_000, 10, "buy")

    cash_id = _get(auth_client, "/cash")["asset_id"]
    deposit_entry = next(
        entry
        for entry in _get(auth_client, f"/assets/{cash_id}/entries")
        if entry["entry_type"] == "deposit"
    )
    blocked = auth_client.delete(
        f"{API}/assets/{cash_id}/entries/{deposit_entry['id']}"
    )
    assert blocked.status_code == 422
    assert "Cash balance" in blocked.json()["detail"]
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(0.0)
    assert len(_get(auth_client, f"/assets/{cash_id}/entries")) == 1


def test_cash_and_holding_guardrails(auth_client):
    _deposit(auth_client, "2024-01-01", 10_000)
    stock = _create_asset(auth_client, "Guardrail Stock", "stock")
    stock_id = stock["id"]
    _add_entry(auth_client, stock_id, "2024-01-02", 10_000, 10, "buy")

    future = (date.today() + timedelta(days=1)).isoformat()
    cases = [
        (
            f"/assets/{stock_id}/entries",
            {
                "date": future,
                "value": 100,
                "units": 1,
                "entry_type": "buy",
                "affects_cash": True,
            },
            "future",
        ),
        (
            f"/assets/{stock_id}/entries",
            {
                "date": "2024-02-30",
                "value": 100,
                "units": 1,
                "entry_type": "buy",
                "affects_cash": True,
            },
            "Invalid date",
        ),
        (
            f"/assets/{stock_id}/entries",
            {
                "date": "2024-02-01",
                "value": 0,
                "units": 1,
                "entry_type": "buy",
                "affects_cash": True,
            },
            "greater than zero",
        ),
        (
            f"/assets/{stock_id}/entries",
            {
                "date": "2024-02-01",
                "value": 100,
                "units": 11,
                "entry_type": "sell",
                "affects_cash": True,
            },
            "more units",
        ),
        (
            f"/assets/{stock_id}/entries",
            {
                "date": "2024-02-01",
                "value": 100,
                "units": 1,
                "entry_type": "deposit",
                "affects_cash": True,
            },
            "must be a buy or sell",
        ),
        (
            "/cash/withdraw",
            {"date": "2024-02-01", "value": 1},
            "Cash balance",
        ),
    ]
    for path, payload, message in cases:
        response = auth_client.post(f"{API}{path}", json=payload)
        assert response.status_code == 422, (path, response.text)
        assert message.lower() in response.text.lower()

    zero_deposit = auth_client.post(
        f"{API}/cash/deposit", json={"date": "2024-02-01", "value": 0}
    )
    assert zero_deposit.status_code == 422

    no_cash = _post(
        auth_client,
        "/assets",
        {
            "name": "No Cash Stock",
            "asset_type": "stock",
            "initial_date": "2024-01-01",
            "initial_value": 1_000_000,
            "initial_units": 1,
        },
        expected=422,
    )
    assert "Cash balance" in str(no_cash)


def test_asset_crud_cash_protection_and_delete_rollback(auth_client):
    _deposit(auth_client, "2023-01-01", 10_000)
    stock = _create_asset(auth_client, "CRUD Stock", "stock")
    stock_id = stock["id"]
    _add_entry(auth_client, stock_id, "2023-01-02", 10_000, 10, "buy")
    assert _get(auth_client, "/cash")["balance"] == pytest.approx(0.0)

    updated = _put(
        auth_client,
        f"/assets/{stock_id}",
        {
            "name": "CRUD Stock Renamed",
            "asset_type": "ppf",
            "symbol": None,
            "notes": "changed type",
        },
    )
    assert updated["name"] == "CRUD Stock Renamed"
    assert updated["category"] == "debt"

    cash_id = _get(auth_client, "/cash")["asset_id"]
    assert (
        auth_client.post(
            f"{API}/assets", json={"name": "Manual Cash", "asset_type": "cash"}
        ).status_code
        == 400
    )
    assert (
        auth_client.put(
            f"{API}/assets/{cash_id}",
            json={"name": "Cash", "asset_type": "cash"},
        ).status_code
        == 400
    )
    assert auth_client.delete(f"{API}/assets/{cash_id}").status_code == 400

    for path in [
        "/assets/999999",
        "/assets/999999/valuation",
        "/assets/999999/entries",
    ]:
        assert auth_client.get(f"{API}{path}").status_code == 404
    assert (
        auth_client.put(
            f"{API}/assets/999999",
            json={"name": "Missing", "asset_type": "stock"},
        ).status_code
        == 404
    )
    assert auth_client.delete(f"{API}/assets/999999").status_code == 404

    delete = auth_client.delete(f"{API}/assets/{stock_id}")
    assert delete.status_code == 204, delete.text
    cash = _get(auth_client, "/cash")
    assert cash["balance"] == pytest.approx(10_000.0)
    summary = _get(auth_client, "/dashboard/summary")
    assert summary["portfolio_value"] == pytest.approx(0.0)
    assert summary["net_worth"] == pytest.approx(10_000.0)
    assert summary["asset_count"] == 0
    assert _get(auth_client, "/dashboard/trend")["points"][-1][
        "total_value"
    ] == pytest.approx(10_000.0)


def test_every_asset_type_valuation_and_category_totals(auth_client):
    _deposit(auth_client, "2024-01-01", 100_000)
    asset_types = [
        ("Type Stock", "stock"),
        ("Type Mutual Fund", "mutual_fund"),
        ("Type Fixed Deposit", "fixed_deposit"),
        ("Type Liquid Fund", "liquid_fund"),
        ("Type Arbitrage Fund", "arbitrage_fund"),
        ("Type NPS", "nps"),
        ("Type PPF", "ppf"),
        ("Type PF", "pf"),
        ("Type Bank Balance", "bank_balance"),
        ("Type Gold", "physical_gold"),
        ("Type Real Estate", "real_estate"),
    ]
    for name, asset_type in asset_types:
        payload = {
            "name": name,
            "asset_type": asset_type,
            "initial_date": "2024-01-01",
            "initial_value": 1000,
            "initial_units": 1,
        }
        if asset_type == "physical_gold":
            payload["details"] = {"purity": "22k"}

        response = auth_client.post(f"{API}/assets", json=payload)
        assert response.status_code == 201, response.text
        assert (
            response.json()["category"]
            == {
                "stock": "equity",
                "mutual_fund": "equity",
                "fixed_deposit": "debt",
                "liquid_fund": "debt",
                "arbitrage_fund": "debt",
                "nps": "others",
                "ppf": "debt",
                "pf": "debt",
                "bank_balance": "cash",
                "physical_gold": "gold",
                "real_estate": "real_estate",
            }[asset_type]
        )

    summary = _get(auth_client, "/dashboard/summary")
    assert summary["cash_value"] == pytest.approx(89_000.0)
    assert summary["portfolio_value"] == pytest.approx(6_000.0)
    assert summary["net_worth"] == pytest.approx(100_000.0)
    assert summary["asset_count"] == len(asset_types)

    allocation = _get(auth_client, "/dashboard/allocation")
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category == pytest.approx(
        {
            "cash": 90_000.0,
            "debt": 5000.0,
            "equity": 2000.0,
            "others": 1000.0,
            "gold": 1000.0,
            "real_estate": 1000.0,
        }
    )
    assert _get(auth_client, "/dashboard/trend")["points"][-1][
        "total_value"
    ] == pytest.approx(100_000.0)
    # With no market price cached, XIRR falls back to invested value: 0% gain.
    assert _get(auth_client, "/dashboard/xirr")["xirr"] == pytest.approx(0.0, abs=1e-12)


def test_legacy_entry_without_cash_effect_keeps_net_worth_semantics(auth_client):
    stock = _create_asset(auth_client, "Legacy Stock", "stock")
    _add_entry(
        auth_client,
        stock["id"],
        "2016-06-01",
        5000,
        5,
        "buy",
        affects_cash=False,
    )

    cash = _get(auth_client, "/cash")
    assert cash["balance"] == pytest.approx(0.0)
    assert cash["total_buys"] == pytest.approx(0.0)
    summary = _get(auth_client, "/dashboard/summary")
    assert summary["portfolio_value"] == pytest.approx(5000.0)
    assert summary["net_worth"] == pytest.approx(5000.0)
    assert summary["cash_value"] == pytest.approx(0.0)
    assert _get(auth_client, "/dashboard/trend")["points"][-1][
        "total_value"
    ] == pytest.approx(5000.0)

    _deposit(auth_client, "2024-01-01", 1000)
    summary = _get(auth_client, "/dashboard/summary")
    assert summary["cash_value"] == pytest.approx(1000.0)
    assert summary["net_worth"] == pytest.approx(6000.0)


def test_fully_sold_asset_is_closed_but_history_remains(auth_client):
    _deposit(auth_client, "2022-01-01", 10_000)
    stock = _create_asset(auth_client, "Closed Stock", "stock")
    _add_entry(auth_client, stock["id"], "2022-01-02", 10_000, 10, "buy")
    _add_entry(auth_client, stock["id"], "2022-02-01", 12_000, 10, "sell")

    active = _get(auth_client, "/assets?include_closed=false")
    assert all(asset["id"] != stock["id"] for asset in active)
    all_assets = _get(auth_client, "/assets")
    assert any(asset["id"] == stock["id"] for asset in all_assets)
    summary = _get(auth_client, "/dashboard/summary")
    assert summary["asset_count"] == 0
    assert summary["portfolio_value"] == pytest.approx(0.0)
    assert summary["cash_value"] == pytest.approx(12_000.0)
    assert summary["net_worth"] == pytest.approx(12_000.0)


def test_xirr_history_backfill_is_daily_and_respects_minimum_window(
    auth_client, monkeypatch
):
    _deposit(auth_client, "2022-01-01", 5000)
    stock = _create_asset(auth_client, "Backfill Stock", "stock", symbol="BACKFILL.NS")
    _add_entry(auth_client, stock["id"], "2022-01-01", 1000, 10, "buy")
    _add_entry(auth_client, stock["id"], "2022-02-01", 1100, 10, "buy")
    _add_entry(auth_client, stock["id"], "2022-03-01", 750, 5, "sell")

    prices = {
        "2022-01-01": 100.0,
        "2022-02-01": 110.0,
        "2022-03-01": 150.0,
        "2022-04-01": 160.0,
    }
    monkeypatch.setattr(
        "app.services.xirr_history.fetch_price_history",
        lambda *args, **kwargs: prices,
    )

    with Session(engine) as session:
        session.exec(XirrSnapshot.__table__.delete())
        session.commit()
        added = __import__(
            "app.services.xirr_history", fromlist=["backfill_xirr_history"]
        ).backfill_xirr_history(session, today=date(2022, 4, 15))
        snapshots = session.exec(select(XirrSnapshot).order_by(XirrSnapshot.date)).all()

    assert added == (date(2022, 4, 15) - date(2022, 1, 1)).days
    assert len(snapshots) == added
    assert [snapshot.date for snapshot in snapshots] == [
        (date(2022, 1, 1) + timedelta(days=offset)).isoformat()
        for offset in range(added)
    ]
    assert all(snapshot.xirr is None for snapshot in snapshots[:30])
    assert any(snapshot.xirr is not None for snapshot in snapshots[30:])


def test_recalculate_xirr_history_refreshes_edited_entry(auth_client, monkeypatch):
    _deposit(auth_client, "2022-01-01", 5000)
    stock = _create_asset(auth_client, "Recalc Stock", "stock", symbol="RECALC.NS")
    entry = _add_entry(auth_client, stock["id"], "2022-01-01", 1000, 10, "buy")

    prices = {
        "2022-01-01": 100.0,
        "2022-02-01": 120.0,
        "2022-03-01": 150.0,
    }
    monkeypatch.setattr(
        "app.services.xirr_history.fetch_price_history",
        lambda *args, **kwargs: prices,
    )

    from app.services.xirr_history import (
        backfill_xirr_history,
        recalculate_xirr_history,
    )

    with Session(engine) as session:
        session.exec(XirrSnapshot.__table__.delete())
        session.commit()
        backfill_xirr_history(session, today=date(2022, 4, 15))
        before = {
            snapshot.date: snapshot.xirr
            for snapshot in session.exec(select(XirrSnapshot)).all()
        }

    _put(
        auth_client,
        f"/assets/{stock['id']}/entries/{entry['id']}",
        {
            "date": "2022-01-01",
            "value": 2000,
            "units": 10,
            "entry_type": "buy",
            "affects_cash": False,
        },
    )

    with Session(engine) as session:
        recalculate_xirr_history(session, today=date(2022, 4, 15))
        after = {
            snapshot.date: snapshot.xirr
            for snapshot in session.exec(select(XirrSnapshot)).all()
        }

    assert before["2022-04-10"] is not None
    assert after["2022-04-10"] is not None
    assert before["2022-04-10"] != pytest.approx(after["2022-04-10"])
    assert "2022-04-15" in after


def test_backdated_entry_changes_trigger_xirr_recalculation(auth_client, monkeypatch):
    calls: list[bool] = []
    monkeypatch.setattr(
        "app.api.entries.recalculate_xirr_history",
        lambda session: calls.append(True) or 0,
    )
    monkeypatch.setattr("app.api.entries.settings.environment", "production")

    _deposit(auth_client, "2025-01-01", 5000)
    stock = _create_asset(auth_client, "Trigger Stock", "stock", symbol="TRIGGER.NS")

    entry = _add_entry(auth_client, stock["id"], "2025-01-02", 1000, 10, "buy")
    assert len(calls) == 1

    _put(
        auth_client,
        f"/assets/{stock['id']}/entries/{entry['id']}",
        {
            "date": "2025-01-02",
            "value": 1000,
            "units": 10,
            "entry_type": "buy",
            "affects_cash": False,
        },
    )
    assert len(calls) == 2

    _add_entry(
        auth_client,
        stock["id"],
        date.today().isoformat(),
        500,
        5,
        "buy",
        affects_cash=False,
    )
    assert len(calls) == 2

    response = auth_client.delete(f"{API}/assets/{stock['id']}/entries/{entry['id']}")
    assert response.status_code == 204, response.text
    assert len(calls) == 3


def test_two_sessions_share_portfolio_and_logout_is_isolated(auth_client):
    second = TestClient(app)
    try:
        login = second.post(
            f"{API}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
        )
        assert login.status_code == 200, login.text
        second.headers.update({"X-CSRF-Token": login.json()["csrf_token"]})

        assert _get(auth_client, "/auth/me")["username"] == TEST_USERNAME
        assert _get(second, "/auth/me")["username"] == TEST_USERNAME

        _deposit(auth_client, "2025-01-01", 5000)
        asset = _create_asset(auth_client, "Shared Stock", "stock")
        assert any(
            item["id"] == asset["id"]
            for item in _get(second, "/assets?include_closed=false")
        )

        _add_entry(second, asset["id"], "2025-01-02", 5000, 10, "buy")
        cash = _get(auth_client, "/cash")
        assert cash["balance"] == pytest.approx(0.0)
        assert _get(auth_client, f"/assets/{asset['id']}/valuation")[
            "total_units"
        ] == pytest.approx(10.0)

        cross_token = auth_client.post(
            f"{API}/assets",
            headers={
                "X-CSRF-Token": second.headers["X-CSRF-Token"],
            },
            json={"name": "Cross Token", "asset_type": "stock"},
        )
        assert cross_token.status_code == 403

        _put(
            second,
            f"/assets/{asset['id']}",
            {"name": "Shared Stock Renamed", "asset_type": "stock"},
        )
        assert (
            _get(auth_client, f"/assets/{asset['id']}")["name"]
            == "Shared Stock Renamed"
        )

        assert second.post(f"{API}/auth/logout").status_code == 204
        assert auth_client.get(f"{API}/auth/me").status_code == 200
        assert second.get(f"{API}/auth/me").status_code == 401
        assert _post(
            auth_client,
            "/cash/deposit",
            {"date": "2025-01-03", "value": 100},
        )["balance"] == pytest.approx(100.0)
    finally:
        second.close()


def test_market_data_sync_and_status(auth_client, monkeypatch):
    _deposit(auth_client, "2026-01-01", 10_000)
    stock = _create_asset(auth_client, "Sync Stock", "stock", symbol="SYNC.NS")
    _add_entry(
        auth_client,
        stock["id"],
        "2026-01-01",
        10_000,
        10,
        "buy",
    )

    monkeypatch.setattr(
        "app.services.market_data.fetch_market_price",
        lambda asset_type, symbol: (321.5, "scenario-feed"),
    )

    response = auth_client.post(f"{API}/sync/market-data")
    assert response.status_code == 202
    assert response.json()["status"] == "started"

    valuation = _get(auth_client, f"/assets/{stock['id']}/valuation")
    assert valuation["latest_price"] == pytest.approx(321.5)
    assert valuation["current_value"] == pytest.approx(3215.0)
    assert valuation["price_source"] == "scenario-feed"

    status = _get(auth_client, "/sync/market-data/status")
    assert status["last_sync_at"] is not None
    assert status["stale_assets"] == []

    with Session(engine) as session:
        cache = session.exec(
            select(MarketDataCache).where(MarketDataCache.symbol == "SYNC.NS")
        ).one()
        cache.fetched_at = cache.fetched_at - timedelta(hours=48)
        session.add(cache)
        session.commit()

    status = _get(auth_client, "/sync/market-data/status")
    assert [item["symbol"] for item in status["stale_assets"]] == ["SYNC.NS"]
    assert status["stale_assets"][0]["last_price"] == pytest.approx(321.5)

    auth_client.post(f"{API}/sync/market-data")
    assert _get(auth_client, "/sync/market-data/status")["stale_assets"] == []


def test_search_validation_and_provider_results(auth_client, monkeypatch):
    monkeypatch.setattr(
        "app.api.search.search_yahoo_stocks",
        lambda query: [{"symbol": "INFY.NS", "name": f"{query} Ltd"}],
    )
    monkeypatch.setattr(
        "app.api.search.search_mfapi_schemes",
        lambda query: [{"scheme_code": "123", "scheme_name": f"{query} Fund"}],
    )

    stocks = _get(auth_client, "/search?query=infy&type=stock")
    assert stocks["results"] == [{"symbol": "INFY.NS", "name": "infy Ltd"}]
    funds = _get(auth_client, "/search?query=index&type=mutual_fund")
    assert funds["results"][0]["scheme_code"] == "123"

    assert auth_client.get(f"{API}/search?type=stock").status_code == 422
    assert auth_client.get(f"{API}/search?query=infy&type=bond").status_code == 422


def test_legacy_database_migration_preserves_rows(tmp_path, monkeypatch):
    legacy_path = tmp_path / "legacy.db"
    legacy_engine = create_engine(
        f"sqlite:///{legacy_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    with legacy_engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE asset_entry (
                id INTEGER PRIMARY KEY,
                asset_id INTEGER NOT NULL,
                date VARCHAR NOT NULL,
                value FLOAT NOT NULL,
                units FLOAT NOT NULL,
                notes VARCHAR,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                CONSTRAINT uix_asset_date UNIQUE (asset_id, date)
            )
            """
        )
        connection.exec_driver_sql(
            "CREATE INDEX ix_asset_entry_asset_id ON asset_entry (asset_id)"
        )
        connection.exec_driver_sql(
            "CREATE INDEX ix_asset_entry_date ON asset_entry (date)"
        )
        connection.exec_driver_sql(
            """
            INSERT INTO asset_entry
                (id, asset_id, date, value, units, notes, created_at, updated_at)
            VALUES
                (1, 1, '2018-04-01', 15000.0, 100.0, 'legacy buy',
                 '2018-04-01 10:00:00', '2018-04-01 10:00:00')
            """
        )

    monkeypatch.setattr("app.db.engine", legacy_engine)
    from app.db import init_db

    init_db()

    with legacy_engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(asset_entry)")
        }
        assert {"entry_type", "affects_cash", "cash_value", "details"} <= columns

        row = connection.exec_driver_sql(
            "SELECT entry_type, affects_cash, cash_value, value, units "
            "FROM asset_entry WHERE id = 1"
        ).one()
        assert row[0] == "BUY"
        assert row[1] == 0
        assert row[2] is None
        assert row[3] == pytest.approx(15000.0)
        assert row[4] == pytest.approx(100.0)

        table_sql = connection.exec_driver_sql(
            "SELECT sql FROM sqlite_master "
            "WHERE type = 'table' AND name = 'asset_entry'"
        ).one()[0]
        assert "uix_asset_date" not in table_sql

        connection.exec_driver_sql(
            "INSERT INTO asset "
            "(id, name, asset_type, category, created_at, updated_at) "
            "VALUES (1, 'Legacy Asset', 'STOCK', 'EQUITY', "
            "'2018-04-01 10:00:00', '2018-04-01 10:00:00')"
        )
        connection.exec_driver_sql(
            "INSERT INTO asset_entry "
            "(asset_id, date, value, units, entry_type, affects_cash, "
            "created_at, updated_at) "
            "VALUES (1, '2018-04-01', 16000.0, 100.0, 'SELL', 1, "
            "'2018-04-01 10:00:00', '2018-04-01 10:00:00')"
        )

    legacy_engine.dispose()
