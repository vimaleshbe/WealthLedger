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
