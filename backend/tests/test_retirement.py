from datetime import date

import pytest
from sqlmodel import Session

from app.db import engine
from app.services.retirement import get_ppf_maturity_date
from app.services.xirr import get_portfolio_xirr

API = "/api/v1"


def _retirement(client) -> dict:
    response = client.get(f"{API}/retirement")
    assert response.status_code == 200, response.text
    return response.json()


def _account(client, asset_type: str) -> dict:
    accounts = _retirement(client)["accounts"]
    return next(item for item in accounts if item["asset_type"] == asset_type)


def _entry(
    client,
    asset_id: int,
    entry_date: str,
    value: float,
    entry_type: str,
    *,
    units: float = 1,
    details: dict | None = None,
    affects_cash: bool = False,
) -> dict:
    response = client.post(
        f"{API}/assets/{asset_id}/entries",
        json={
            "date": entry_date,
            "value": value,
            "units": units,
            "entry_type": entry_type,
            "affects_cash": affects_cash,
            "details": details,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _summary(client, asset_id: int) -> dict:
    response = client.get(f"{API}/retirement/{asset_id}/summary")
    assert response.status_code == 200, response.text
    return response.json()


def test_retirement_tab_creates_one_account_per_scheme(clean_database):
    client = clean_database

    first = _retirement(client)
    assert first["total_balance"] == pytest.approx(0)
    assert [(item["asset_type"], item["name"]) for item in first["accounts"]] == [
        ("pf", "PF"),
        ("ppf", "PPF"),
        ("nps", "NPS"),
    ]

    second = _retirement(client)
    assert len(second["accounts"]) == 3
    assert second["total_balance"] == pytest.approx(0)


def test_retirement_balances_are_in_net_worth_but_not_portfolio(clean_database):
    client = clean_database
    pf = _account(client, "pf")
    ppf = _account(client, "ppf")
    nps = _account(client, "nps")

    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 20_000},
    )
    _entry(
        client,
        pf["asset_id"],
        "2024-01-01",
        16_000,
        "buy",
        details={
            "employee_share": 10_000,
            "employer_share": 5_000,
            "pension_share": 1_000,
        },
    )
    _entry(client, ppf["asset_id"], "2024-01-01", 20_000, "buy")
    _entry(client, nps["asset_id"], "2024-01-01", 5_000, "buy")
    _entry(client, ppf["asset_id"], "2025-01-01", 1_000, "interest")
    _entry(client, pf["asset_id"], "2025-06-01", 2_000, "sell")

    listing = _retirement(client)
    by_type = {item["asset_type"]: item for item in listing["accounts"]}
    assert by_type["pf"]["balance"] == pytest.approx(14_000)
    assert by_type["pf"]["employee_total"] == pytest.approx(10_000)
    assert by_type["pf"]["employer_total"] == pytest.approx(5_000)
    assert by_type["pf"]["pension_total"] == pytest.approx(1_000)
    assert by_type["ppf"]["balance"] == pytest.approx(21_000)
    assert by_type["ppf"]["interest_total"] == pytest.approx(1_000)
    assert by_type["nps"]["balance"] == pytest.approx(5_000)
    assert listing["total_balance"] == pytest.approx(40_000)

    dashboard = client.get(f"{API}/dashboard/summary").json()
    assert dashboard["retirement_value"] == pytest.approx(40_000)
    assert dashboard["net_worth"] == pytest.approx(40_000)
    assert dashboard["portfolio_value"] == pytest.approx(0)

    allocation = client.get(f"{API}/dashboard/allocation").json()
    by_category = {
        item["category"]: item["value"] for item in allocation["by_category"]
    }
    assert by_category["debt"] == pytest.approx(35_000)
    assert by_category["others"] == pytest.approx(5_000)


def test_existing_ppf_account_is_preserved(clean_database):
    client = clean_database
    existing = client.post(
        f"{API}/assets",
        json={"name": "My PPF", "asset_type": "ppf"},
    )
    assert existing.status_code == 201, existing.text
    existing_id = existing.json()["id"]
    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 10_000},
    )
    _entry(client, existing_id, "2024-01-01", 10_000, "buy")

    listing = _retirement(client)
    ppf_accounts = [item for item in listing["accounts"] if item["asset_type"] == "ppf"]
    assert len(ppf_accounts) == 1
    assert ppf_accounts[0]["asset_id"] == existing_id
    assert ppf_accounts[0]["name"] == "My PPF"
    assert ppf_accounts[0]["balance"] == pytest.approx(10_000)
    assert {item["asset_type"] for item in listing["accounts"]} == {
        "pf",
        "ppf",
        "nps",
    }


def test_pf_does_not_move_cash_but_ppf_and_nps_can(clean_database):
    client = clean_database
    pf = _account(client, "pf")
    ppf = _account(client, "ppf")
    nps = _account(client, "nps")

    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 25_000},
    )
    _entry(
        client,
        pf["asset_id"],
        "2024-01-02",
        10_000,
        "buy",
        details={
            "employee_share": 6_000,
            "employer_share": 3_000,
            "pension_share": 1_000,
        },
        affects_cash=True,
    )
    _entry(
        client,
        ppf["asset_id"],
        "2024-01-03",
        20_000,
        "buy",
        affects_cash=True,
    )
    _entry(client, nps["asset_id"], "2024-01-04", 5_000, "buy")

    cash = client.get(f"{API}/cash").json()
    assert cash["balance"] == pytest.approx(5_000)
    assert _summary(client, pf["asset_id"])["balance"] == pytest.approx(10_000)
    assert _summary(client, ppf["asset_id"])["balance"] == pytest.approx(20_000)
    assert _summary(client, nps["asset_id"])["balance"] == pytest.approx(5_000)


def test_ppf_entries_always_move_money_through_cash(clean_database):
    client = clean_database
    ppf = _account(client, "ppf")

    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 50_000},
    )
    # PPF does not need the optional affects_cash flag: adding money always
    # debits Cash.
    _entry(client, ppf["asset_id"], "2024-01-02", 20_000, "buy")

    cash = client.get(f"{API}/cash").json()
    assert cash["balance"] == pytest.approx(30_000)
    assert _summary(client, ppf["asset_id"])["balance"] == pytest.approx(20_000)

    # Interest grows the PPF balance without touching Cash.
    _entry(client, ppf["asset_id"], "2024-03-31", 1_200, "interest")
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(30_000)
    assert _summary(client, ppf["asset_id"])["balance"] == pytest.approx(21_200)

    # Selling/withdrawing credits Cash automatically.
    _entry(client, ppf["asset_id"], "2024-06-01", 5_000, "sell")
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(35_000)
    assert _summary(client, ppf["asset_id"])["balance"] == pytest.approx(16_200)


def test_ppf_contribution_is_blocked_when_cash_is_insufficient(clean_database):
    client = clean_database
    ppf = _account(client, "ppf")

    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 5_000},
    )
    response = client.post(
        f"{API}/assets/{ppf['asset_id']}/entries",
        json={
            "date": "2024-01-02",
            "value": 10_000,
            "units": 1,
            "entry_type": "buy",
        },
    )
    assert response.status_code == 422, response.text
    assert "Cash balance" in response.json()["detail"]
    assert _summary(client, ppf["asset_id"])["balance"] == pytest.approx(0)
    assert client.get(f"{API}/cash").json()["balance"] == pytest.approx(5_000)


def test_ppf_maturity_is_fifteen_years_after_first_contribution(clean_database):
    client = clean_database
    ppf = _account(client, "ppf")

    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-04-01", "value": 25_000},
    )
    _entry(client, ppf["asset_id"], "2024-04-01", 10_000, "buy")
    _entry(client, ppf["asset_id"], "2025-04-01", 10_000, "buy")

    summary = _summary(client, ppf["asset_id"])
    assert summary["first_contribution_date"] == "2024-04-01"
    assert summary["last_contribution_date"] == "2025-04-01"
    assert summary["maturity_date"] == "2039-04-01"


def test_ppf_maturity_handles_leap_day_openings():
    assert get_ppf_maturity_date("2024-02-29") == "2039-02-28"
    assert get_ppf_maturity_date(None) is None
    assert get_ppf_maturity_date("not-a-date") is None


def test_retirement_withdrawal_and_delete_guards(clean_database):
    client = clean_database
    pf = _account(client, "pf")
    contribution = _entry(
        client,
        pf["asset_id"],
        "2024-01-01",
        10_000,
        "buy",
        details={
            "employee_share": 10_000,
            "employer_share": 0,
            "pension_share": 0,
        },
    )
    _entry(client, pf["asset_id"], "2024-06-01", 8_000, "sell")

    too_much = client.post(
        f"{API}/assets/{pf['asset_id']}/entries",
        json={
            "date": "2024-07-01",
            "value": 5_000,
            "units": 1,
            "entry_type": "sell",
        },
    )
    assert too_much.status_code == 422, too_much.text

    delete = client.delete(
        f"{API}/assets/{pf['asset_id']}/entries/{contribution['id']}"
    )
    assert delete.status_code == 422, delete.text
    assert "Retirement withdrawal" in delete.json()["detail"]

    assert _summary(client, pf["asset_id"])["balance"] == pytest.approx(2_000)


def test_retirement_is_excluded_from_xirr(clean_database):
    client = clean_database
    pf = _account(client, "pf")
    ppf = _account(client, "ppf")
    client.post(
        f"{API}/cash/deposit",
        json={"date": "2024-01-01", "value": 20_000},
    )
    _entry(
        client,
        pf["asset_id"],
        "2024-01-01",
        10_000,
        "buy",
        details={
            "employee_share": 6_000,
            "employer_share": 3_000,
            "pension_share": 1_000,
        },
    )
    _entry(client, ppf["asset_id"], "2024-01-01", 20_000, "buy")

    with Session(engine) as session:
        assert get_portfolio_xirr(session, scope="portfolio") is None
        assert get_portfolio_xirr(session, scope="equity") is None
        assert get_portfolio_xirr(session, scope="gold") is None


def test_retirement_summary_requires_a_retirement_account(clean_database):
    client = clean_database
    stock = client.post(
        f"{API}/assets",
        json={"name": "Not Retirement", "asset_type": "stock"},
    ).json()

    assert client.get(f"{API}/retirement/{stock['id']}/summary").status_code == 404


def test_nps_uses_units_and_nav(clean_database):
    client = clean_database
    nps = _account(client, "nps")

    _entry(
        client,
        nps["asset_id"],
        "2026-01-01",
        1_200,
        "buy",
        units=100,
        details={"nav": 12},
    )
    _entry(
        client,
        nps["asset_id"],
        "2026-06-01",
        650,
        "buy",
        units=50,
        details={"nav": 13},
    )

    summary = _summary(client, nps["asset_id"])
    assert summary["units"] == pytest.approx(150)
    assert summary["latest_nav"] == pytest.approx(13)
    assert summary["balance"] == pytest.approx(1_950)
    assert summary["invested_value"] == pytest.approx(1_850)
    assert summary["gain"] == pytest.approx(100)

    _entry(
        client,
        nps["asset_id"],
        "2026-10-01",
        260,
        "sell",
        units=20,
        details={"nav": 13},
    )
    summary = _summary(client, nps["asset_id"])
    assert summary["units"] == pytest.approx(130)
    assert summary["withdrawal_total"] == pytest.approx(260)
    assert summary["balance"] == pytest.approx(1_690)
    assert summary["invested_value"] == pytest.approx(1_590)
    assert summary["gain"] == pytest.approx(100)

    oversell = client.post(
        f"{API}/assets/{nps['asset_id']}/entries",
        json={
            "date": "2026-11-01",
            "value": 2_600,
            "units": 200,
            "entry_type": "sell",
            "details": {"nav": 13},
        },
    )
    assert oversell.status_code == 422, oversell.text
    assert "NPS units" in oversell.json()["detail"]

    interest = client.post(
        f"{API}/assets/{nps['asset_id']}/entries",
        json={
            "date": "2026-11-01",
            "value": 100,
            "units": 1,
            "entry_type": "interest",
        },
    )
    assert interest.status_code == 422, interest.text

    valuation = client.get(f"{API}/assets/{nps['asset_id']}/valuation").json()
    assert valuation["total_units"] == pytest.approx(130)
    assert valuation["latest_price"] == pytest.approx(13)
    assert valuation["price_unit"] == "unit"
    assert valuation["current_value"] == pytest.approx(1_690)


def test_pf_legacy_entry_without_components_is_unclassified(clean_database):
    client = clean_database
    pf = _account(client, "pf")

    response = client.post(
        f"{API}/assets/{pf['asset_id']}/entries",
        json={
            "date": date.today().isoformat(),
            "value": 5_000,
            "units": 1,
            "entry_type": "buy",
        },
    )
    assert response.status_code == 201, response.text

    summary = _summary(client, pf["asset_id"])
    assert summary["balance"] == pytest.approx(5_000)
    assert summary["invested_value"] == pytest.approx(5_000)
    assert summary["unclassified_total"] == pytest.approx(5_000)
