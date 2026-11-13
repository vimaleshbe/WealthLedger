import math
from datetime import date


def _create_asset(auth_client, *, initial_value: float | None = None):
    payload = {
        "name": "Cash Test Stock",
        "asset_type": "stock",
        "symbol": "TEST.NS",
    }
    if initial_value is not None:
        payload.update(
            {
                "initial_date": "2026-01-10",
                "initial_value": initial_value,
                "initial_units": 10,
            }
        )
    return auth_client.post("/api/v1/assets", json=payload)


def _drain_cash(auth_client) -> None:
    balance = auth_client.get("/api/v1/cash").json()["balance"]
    if balance > 0:
        response = auth_client.post(
            "/api/v1/cash/withdraw",
            json={"date": "2026-01-01", "value": balance},
        )
        assert response.status_code == 201, response.text


def test_cash_deposit_buy_and_sell(auth_client):
    _drain_cash(auth_client)

    initial = auth_client.get("/api/v1/cash")
    assert initial.status_code == 200
    assert initial.json()["balance"] == 0

    deposit = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-01-01", "value": 100000, "notes": "Starting cash"},
    )
    assert deposit.status_code == 201
    assert deposit.json()["balance"] == 100000

    asset = _create_asset(auth_client, initial_value=50000)
    assert asset.status_code == 201, asset.text
    asset_id = asset.json()["id"]

    cash = auth_client.get("/api/v1/cash").json()
    assert cash["balance"] == 50000
    assert cash["total_deposits"] == 100000
    assert cash["total_buys"] == 50000

    sale = auth_client.post(
        f"/api/v1/assets/{asset_id}/entries",
        json={
            "date": "2026-02-01",
            "value": 24000,
            "units": 4,
            "entry_type": "sell",
            "affects_cash": True,
            "notes": "Partial sale",
        },
    )
    assert sale.status_code == 201, sale.text
    sale_data = sale.json()
    assert sale_data["entry_type"] == "sell"
    assert sale_data["cash_value"] == 24000
    assert sale_data["value"] == 20000

    cash = auth_client.get("/api/v1/cash").json()
    assert cash["balance"] == 74000
    assert cash["total_sells"] == 24000

    valuation = auth_client.get(f"/api/v1/assets/{asset_id}/valuation").json()
    assert valuation["invested_value"] == 30000
    assert valuation["total_units"] == 6

    summary = auth_client.get("/api/v1/dashboard/summary").json()
    assert summary["cash_value"] == 74000
    assert summary["cash_asset_id"] == cash["asset_id"]

    allocation = auth_client.get("/api/v1/dashboard/allocation").json()
    cash_slice = next(
        item for item in allocation["by_asset_type"] if item["asset_type"] == "cash"
    )
    assert cash_slice["value"] == 74000
    assert any(item["category"] == "cash" for item in allocation["by_category"])
    assert any(item["name"] == "Cash" for item in allocation["by_asset"])
    assert any(item["name"] == "Cash Test Stock" for item in allocation["by_asset"])


def test_buy_requires_cash(auth_client):
    _drain_cash(auth_client)

    response = _create_asset(auth_client, initial_value=1000)
    assert response.status_code == 422
    assert "Cash balance" in response.json()["detail"]


def test_cannot_sell_more_than_held_or_withdraw_too_much(auth_client):
    _drain_cash(auth_client)

    deposit = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-01-01", "value": 10000},
    )
    assert deposit.status_code == 201

    asset = _create_asset(auth_client, initial_value=10000)
    assert asset.status_code == 201
    asset_id = asset.json()["id"]

    oversell = auth_client.post(
        f"/api/v1/assets/{asset_id}/entries",
        json={
            "date": "2026-02-01",
            "value": 2000,
            "units": 11,
            "entry_type": "sell",
            "affects_cash": True,
        },
    )
    assert oversell.status_code == 422
    assert "more units" in oversell.json()["detail"]

    withdraw = auth_client.post(
        "/api/v1/cash/withdraw",
        json={"date": "2026-02-01", "value": 1},
    )
    assert withdraw.status_code == 422


def test_allocation_groups_debt_gold_and_others(auth_client):
    _drain_cash(auth_client)

    deposit = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-01-01", "value": 50000},
    )
    assert deposit.status_code == 201

    for name, asset_type, value in [
        ("Test PPF", "ppf", 10000),
        ("Test Gold", "physical_gold", 5000),
        ("Test NPS", "nps", 5000),
    ]:
        payload = {
            "name": name,
            "asset_type": asset_type,
            "initial_date": "2026-01-02",
            "initial_value": value,
            "initial_units": 1,
        }
        if asset_type == "physical_gold":
            payload["details"] = {"purity": "22k"}

        response = auth_client.post("/api/v1/assets", json=payload)
        assert response.status_code == 201, response.text

    allocation = auth_client.get("/api/v1/dashboard/allocation").json()
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category["debt"] == 10000
    assert by_category["gold"] == 5000
    assert by_category["others"] == 5000
    assert by_category["cash"] == 30000


def test_edit_and_delete_sale_recalculates_cash_and_cost_basis(auth_client):
    _drain_cash(auth_client)

    auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-01-01", "value": 10000},
    )
    asset = _create_asset(auth_client, initial_value=10000)
    asset_id = asset.json()["id"]

    sale = auth_client.post(
        f"/api/v1/assets/{asset_id}/entries",
        json={
            "date": "2026-02-01",
            "value": 2000,
            "units": 4,
            "entry_type": "sell",
            "affects_cash": True,
        },
    )
    assert sale.status_code == 201
    entry_id = sale.json()["id"]

    update = auth_client.put(
        f"/api/v1/assets/{asset_id}/entries/{entry_id}",
        json={
            "date": "2026-02-01",
            "value": 3000,
            "units": 6,
            "entry_type": "sell",
            "affects_cash": True,
        },
    )
    assert update.status_code == 200, update.text
    assert update.json()["value"] == 6000
    assert update.json()["cash_value"] == 3000

    valuation = auth_client.get(f"/api/v1/assets/{asset_id}/valuation").json()
    assert valuation["total_units"] == 4
    assert valuation["invested_value"] == 4000
    assert auth_client.get("/api/v1/cash").json()["balance"] == 3000

    delete = auth_client.delete(f"/api/v1/assets/{asset_id}/entries/{entry_id}")
    assert delete.status_code == 204

    valuation = auth_client.get(f"/api/v1/assets/{asset_id}/valuation").json()
    assert valuation["total_units"] == 10
    assert valuation["invested_value"] == 10000
    assert auth_client.get("/api/v1/cash").json()["balance"] == 0


def test_xirr_history_records_one_point_per_day(auth_client):
    today = date.today().isoformat()

    first = auth_client.get("/api/v1/dashboard/xirr/history")
    assert first.status_code == 200
    today_points = [p for p in first.json()["points"] if p["date"] == today]
    assert len(today_points) == 1

    current = auth_client.get("/api/v1/dashboard/xirr").json()
    assert today_points[0]["xirr_percent"] == current["xirr_percent"]

    # Repeated dashboard loads refresh today's point instead of duplicating it.
    second = auth_client.get("/api/v1/dashboard/xirr/history")
    assert second.status_code == 200
    today_points = [p for p in second.json()["points"] if p["date"] == today]
    assert len(today_points) == 1


def test_fully_sold_asset_is_hidden_from_active_assets_and_count(auth_client):
    _drain_cash(auth_client)

    deposit = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-01-01", "value": 20000},
    )
    assert deposit.status_code == 201

    asset = _create_asset(auth_client, initial_value=10000)
    assert asset.status_code == 201, asset.text
    asset_id = asset.json()["id"]

    active_before = [
        item
        for item in auth_client.get("/api/v1/assets?include_closed=false").json()
        if item["asset_type"] != "cash"
    ]
    assert any(item["id"] == asset_id for item in active_before)
    summary_before = auth_client.get("/api/v1/dashboard/summary").json()
    assert summary_before["asset_count"] == len(active_before)

    sale = auth_client.post(
        f"/api/v1/assets/{asset_id}/entries",
        json={
            "date": "2026-02-01",
            "value": 12000,
            "units": 10,
            "entry_type": "sell",
            "affects_cash": True,
        },
    )
    assert sale.status_code == 201, sale.text

    # History stays available to the Transactions page.
    all_assets = auth_client.get("/api/v1/assets").json()
    assert any(item["id"] == asset_id for item in all_assets)

    # But the closed holding disappears from active lists and counts.
    active_after = [
        item
        for item in auth_client.get("/api/v1/assets?include_closed=false").json()
        if item["asset_type"] != "cash"
    ]
    assert all(item["id"] != asset_id for item in active_after)

    summary_after = auth_client.get("/api/v1/dashboard/summary").json()
    assert summary_after["asset_count"] == len(active_after)
    assert summary_after["portfolio_value"] == summary_before["portfolio_value"] - 10000

    # Cash is part of net worth, but never part of Total Portfolio Value.
    extra_cash = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-02-02", "value": 1000},
    )
    assert extra_cash.status_code == 201
    summary_with_cash = auth_client.get("/api/v1/dashboard/summary").json()
    assert summary_with_cash["portfolio_value"] == summary_after["portfolio_value"]
    assert summary_with_cash["cash_value"] == summary_after["cash_value"] + 1000
    assert summary_with_cash["net_worth"] == summary_after["net_worth"] + 1000


def test_xirr_history_backfills_past_days(auth_client, monkeypatch):
    from sqlmodel import Session

    from app.db import engine
    from app.services.xirr_history import backfill_xirr_history

    monkeypatch.setattr(
        "app.services.xirr_history.fetch_price_history", lambda *args: {}
    )
    with Session(engine) as session:
        added = backfill_xirr_history(session)
    assert added > 0

    history = auth_client.get("/api/v1/dashboard/xirr/history").json()["points"]
    today = date.today().isoformat()
    assert any(point["date"] < today for point in history)
    assert len([point for point in history if point["date"] == today]) == 1


def test_cash_balance_normalizes_negative_zero(auth_client):
    _drain_cash(auth_client)

    deposit = auth_client.post(
        "/api/v1/cash/deposit",
        json={"date": "2026-03-01", "value": 100},
    )
    assert deposit.status_code == 201

    # A sub-paisa over-withdrawal must display as zero, not -₹0.
    withdraw = auth_client.post(
        "/api/v1/cash/withdraw",
        json={"date": "2026-03-02", "value": 100.004},
    )
    assert withdraw.status_code == 201, withdraw.text

    balance = auth_client.get("/api/v1/cash").json()["balance"]
    assert balance == 0
    assert math.copysign(1.0, balance) == 1.0
