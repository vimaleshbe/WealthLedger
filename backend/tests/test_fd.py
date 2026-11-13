import pytest

API = "/api/v1"


def _create_fd(
    client,
    *,
    name: str,
    principal: float,
    start: str,
    months: int,
    rate: float,
) -> dict:
    response = client.post(
        f"{API}/assets",
        json={
            "name": name,
            "asset_type": "fixed_deposit",
            "details": {
                "start_date": start,
                "tenure_months": months,
                "interest_rate": rate,
            },
            "initial_date": start,
            "initial_value": principal,
            "initial_units": 1,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _entry(
    client,
    asset_id: int,
    day: str,
    value: float,
    entry_type: str,
    *,
    affects_cash: bool = False,
) -> dict:
    response = client.post(
        f"{API}/assets/{asset_id}/entries",
        json={
            "date": day,
            "value": value,
            "units": 1,
            "entry_type": entry_type,
            "affects_cash": affects_cash,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _fd(client, asset_id: int) -> dict:
    response = client.get(f"{API}/fd/{asset_id}/summary")
    assert response.status_code == 200, response.text
    return response.json()


def test_fd_tracks_principal_interest_tenure_and_maturity(clean_database):
    client = clean_database
    client.post(
        f"{API}/cash/deposit",
        json={"date": "2026-01-01", "value": 200_000},
    )

    fd = _create_fd(
        client,
        name="SBI 1Y",
        principal=100_000,
        start="2026-01-01",
        months=12,
        rate=5,
    )

    listing = client.get(f"{API}/fd")
    assert listing.status_code == 200, listing.text
    assert len(listing.json()) == 1
    summary = listing.json()[0]
    assert summary["asset_id"] == fd["id"]
    assert summary["principal"] == pytest.approx(100_000)
    assert summary["balance"] == pytest.approx(100_000)
    assert summary["interest_rate"] == pytest.approx(5)
    assert summary["tenure_months"] == 12
    assert summary["maturity_date"] == "2027-01-01"
    assert summary["maturity_value"] == pytest.approx(105_000)

    # Principal is paid from Cash automatically.
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(100_000)

    _entry(client, fd["id"], "2026-06-30", 2_500, "interest")
    summary = _fd(client, fd["id"])
    assert summary["interest"] == pytest.approx(2_500)
    assert summary["balance"] == pytest.approx(102_500)
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(100_000)

    _entry(
        client,
        fd["id"],
        "2026-10-01",
        50_000,
        "sell",
        affects_cash=True,
    )
    summary = _fd(client, fd["id"])
    assert summary["withdrawals"] == pytest.approx(50_000)
    assert summary["balance"] == pytest.approx(52_500)
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(150_000)

    dashboard = client.get(f"{API}/dashboard/summary").json()
    assert dashboard["portfolio_value"] == pytest.approx(52_500)
    assert dashboard["net_worth"] == pytest.approx(202_500)


def test_fd_withdrawal_cannot_exceed_balance(clean_database):
    client = clean_database
    client.post(
        f"{API}/cash/deposit",
        json={"date": "2026-01-01", "value": 100_000},
    )
    fd = _create_fd(
        client,
        name="Small FD",
        principal=50_000,
        start="2026-01-01",
        months=12,
        rate=5,
    )

    response = client.post(
        f"{API}/assets/{fd['id']}/entries",
        json={
            "date": "2026-06-01",
            "value": 60_000,
            "units": 1,
            "entry_type": "sell",
            "affects_cash": True,
        },
    )
    assert response.status_code == 422, response.text
    assert "FD withdrawal" in response.json()["detail"]
    assert _fd(client, fd["id"])["balance"] == pytest.approx(50_000)


def test_multiple_fds_with_different_tenures(clean_database):
    client = clean_database
    client.post(
        f"{API}/cash/deposit",
        json={"date": "2026-01-01", "value": 200_000},
    )

    first = _create_fd(
        client,
        name="1Y FD",
        principal=50_000,
        start="2026-01-01",
        months=12,
        rate=5,
    )
    second = _create_fd(
        client,
        name="10Y FD",
        principal=100_000,
        start="2026-01-01",
        months=120,
        rate=7,
    )

    listing = client.get(f"{API}/fd").json()
    assert {item["asset_id"] for item in listing} == {first["id"], second["id"]}
    by_id = {item["asset_id"]: item for item in listing}
    assert by_id[first["id"]]["maturity_date"] == "2027-01-01"
    assert by_id[second["id"]]["maturity_date"] == "2036-01-01"
    assert by_id[second["id"]]["maturity_value"] == pytest.approx(
        100_000 * 1.07**10,
        abs=0.01,
    )

    # A partially withdrawn FD stays visible in active lists.
    _entry(
        client,
        first["id"],
        "2026-07-01",
        10_000,
        "sell",
        affects_cash=True,
    )
    active = client.get(f"{API}/assets?include_closed=false").json()
    assert any(asset["id"] == first["id"] for asset in active)
