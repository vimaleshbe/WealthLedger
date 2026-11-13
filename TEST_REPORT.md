# WealthLedger Scenario Audit — 2026-11-12

## Safety

- All scenario tests ran against throwaway SQLite databases created by
  `backend/tests/conftest.py` (`portfolio-tests-*`). The test fixture refuses
  to clean a database whose URL does not contain `portfolio-tests-`.
- The live HTTP smoke test used a separate temporary database
  (`portfolio-live-smoke-*`).
- Both temporary databases were deleted after testing.
- `backend/data/app.db` and `backend/portfolio_backup.json` were not restored,
  reseeded, reset or bulk-modified.
- The running Docker container on port 8000 was left untouched. It may update
  its own today XIRR snapshot when the dashboard is opened; that is normal app
  behavior, not part of this audit.

## Data volume used

The long-horizon scenario covers **2019-01-01 through 2026-01-05**:

| Item | Count |
| --- | ---: |
| Cash deposits / withdrawals | 90 |
| Asset buys / sells | 154 |
| Total entries | 244 |
| Portfolio assets | 7 |
| Asset types exercised | 7 in the main scenario; all 11 in a dedicated test |

The main scenario includes monthly SIPs, quarterly stock purchases, annual PPF,
FD, gold and NPS contributions, a real-estate purchase, annual partial sales
and annual cash withdrawals.

## Results

| Suite | Result |
| --- | --- |
| Existing backend tests | 53 passed |
| New long-horizon / scenario tests | 16 passed |
| **Full backend suite** | **69 passed in 9.03s** |
| Frontend unit tests | 16 passed |
| Frontend production build (`tsc -b && vite build`) | passed |
| Live uvicorn smoke test using a temp DB | passed |

Commands used:

```bash
cd backend
uv run pytest -q
uv run pytest tests/test_scenarios.py --durations=0 -q
uv run ruff check app tests/test_scenarios.py
uv run ruff format --check app tests/test_scenarios.py

cd ../frontend
npm test -- --run
npm run build
```

## Use-case matrix

All tests are in `backend/tests/test_scenarios.py`.

| # | Use case | Test | Result |
| --- | --- | --- | --- |
| 1 | Seven years of deposits, SIP buys, stock buys, PPF/FD/gold/NPS, real estate, partial sales, withdrawals, valuation, allocation, trend and XIRR | `test_multi_year_portfolio_lifecycle` | PASS |
| 2 | Known XIRR: 100% one-year return, 2-year CAGR, -50% loss, single flow | `test_known_xirr_values` | PASS |
| 3 | XIRR uses market value, ignores PPF and other non-market assets | `test_portfolio_xirr_uses_market_value_and_ignores_non_market_assets` | PASS |
| 4 | Backdated edit and delete recalculate moving-average cost basis, cash, units and snapshots | `test_backdated_edit_delete_recalculates_cost_basis_cash_and_snapshots` | PASS |
| 5 | Buy and sell on the same date | `test_same_day_buy_and_sell_are_allowed_in_order` | PASS |
| 6 | Deleting a cash deposit that would overdraw cash is rejected and rolled back | `test_deleting_a_cash_source_that_would_overdraw_is_rejected` | PASS |
| 7 | Future/invalid dates, zero value, oversell, wrong entry type, over-withdrawal, buy without cash | `test_cash_and_holding_guardrails` | PASS |
| 8 | Asset CRUD, cash asset protection, missing-resource 404s, deleting an asset returns cash and recalculates trend | `test_asset_crud_cash_protection_and_delete_rollback` | PASS |
| 9 | All 11 asset types, category totals, portfolio value vs net worth | `test_every_asset_type_valuation_and_category_totals` | PASS |
| 10 | Legacy entries with `affects_cash=false` do not retroactively change cash | `test_legacy_entry_without_cash_effect_keeps_net_worth_semantics` | PASS |
| 11 | Fully sold asset disappears from active lists/count but keeps history | `test_fully_sold_asset_is_closed_but_history_remains` | PASS |
| 12 | XIRR history backfill: one point per day, 30-day minimum window, historical prices | `test_xirr_history_backfill_is_daily_and_respects_minimum_window` | PASS |
| 13 | Two logged-in sessions share data; cross-session CSRF is rejected; logout is isolated | `test_two_sessions_share_portfolio_and_logout_is_isolated` | PASS |
| 14 | Market-data sync, price cache, asset valuation, stale-asset status | `test_market_data_sync_and_status` | PASS |
| 15 | Search provider results and query validation | `test_search_validation_and_provider_results` | PASS |
| 16 | Legacy pre-cash database migration preserves rows and drops the old unique date constraint | `test_legacy_database_migration_preserves_rows` | PASS |

## Verified accounting behavior

- Cash balance = deposits + sale proceeds − withdrawals − purchases.
- Remaining invested value = buys − moving-average cost basis of sales.
- Units = buys − sells; sales cannot exceed units held on that date.
- Net worth = remaining invested value of all non-cash assets + cash.
- Total Portfolio Value = invested value of stocks, mutual funds, fixed
  deposits, liquid funds, arbitrage funds and PPF.
- Net-worth snapshots are rebuilt on every entry change and equal
  deposits − withdrawals + realised gains/losses.
- XIRR cash flows use purchases as outflows, sale proceeds as inflows, and
  current market value as the terminal inflow.

## Observations and limits

These are current product behaviors, not test failures:

1. **Dashboard totals are book value, not mark-to-market.** Net worth, Total
   Portfolio Value and the Net Worth Trend use invested/cost-basis values.
   Market prices affect per-asset valuation and XIRR, but unrealized gains do
   not change the dashboard totals or trend.
2. **Trend is book-value net worth.** Purchases paid from cash do not change
   the trend; deposits, withdrawals and realised gains/losses do.
3. **Cash availability is checked against the current total balance, not
   chronologically.** A backdated withdrawal can create a negative historical
   cash position as long as today's total cash balance stays non-negative.
4. **XIRR falls back to invested value when no market price is cached.** With
   no price/NAV available, a position contributes no gain, so XIRR can show
   ~0% until market data is synced.
5. **XIRR covers stocks and mutual funds only.** PPF, FD, NPS, gold, real
   estate and cash are excluded by design.
6. **Collaboration is multiple sessions for one account.** Authentication is
   single-user; there are no separate user accounts or permissions. Sessions
   live in process memory, are capped at 20, and a restart signs everyone out.
7. **Transactions page loads all assets and all entries (N+1 requests) and has
   no pagination.** It was responsive with 244 entries; very large histories
   may eventually need pagination.
8. **Same-day ordering matters.** A sell recorded before its same-day buy is
   rejected because holdings are evaluated in date/id order.

## Defect found and fixed during the audit

`GET /api/v1/assets/{id}/entries` returned `200 []` for a non-existent asset,
while the other asset endpoints returned `404`. It now returns `404 Asset not
found`, covered by test #8.
