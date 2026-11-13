# WealthLedger

**Indian Portfolio Tracker**

WealthLedger is a simple, private, self-hosted way to keep track of your
investments in one place.

Track stocks, mutual funds, fixed deposits, liquid and arbitrage funds, NPS,
PPF, PF, cash, bank balances, physical gold, and real estate. See your total
portfolio, net worth, cash balance, allocation, XIRR, and full entry history —
without sending your financial data to a third-party service.

Everything runs on your own machine in a single Docker container.

## What you can do

- Track stocks, mutual funds, fixed deposits, liquid/arbitrage funds, NPS, PPF, PF, cash, bank balances, gold, and real estate
- Add cash first, then use it to buy assets; sales are credited back to cash
- Add dated entries for each investment and keep the full history
- Search stocks and mutual funds by name or symbol
- Sync the latest prices and NAVs automatically or with one click
- View allocation and portfolio trend charts
- See portfolio, equity, and gold returns as CAGR (after one year) or absolute return, plus XIRR
- Browse all transactions in one place
- Sign in with your own username and password

## Getting started

You only need [Docker](https://www.docker.com/get-started/) installed
(Docker Desktop on Windows and macOS) and a terminal.

### 1. Get the project

Clone the repository or download it as a ZIP, then open a terminal in the
project folder.

### 2. Create your login

Copy the example environment file:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and choose your own username and password:

```env
AUTH_USERNAME=your-username
AUTH_PASSWORD=choose-a-strong-password
```

> Keep `.env` private. It is already excluded from Git, so your password will
> not be published with the repository.

### 3. Start the app

```bash
docker compose up --build -d
```

The first build may take a few minutes. When it finishes, open:

**http://localhost:8000**

Sign in with the username and password you set in `.env`.

To stop the app:

```bash
docker compose down
```

Your data remains in `backend/data/app.db` between restarts and rebuilds.

## Everyday use

- **Dashboard** — total portfolio, net worth, cash balance, CAGR and XIRR tiles
  for the portfolio, equity, and gold scopes, plus allocation and trend charts.
- **Assets** — add or edit stocks, mutual funds, liquid and arbitrage funds,
  bank balances, gold, real estate, and more.
- **Cash** — add or withdraw money. Purchases are paid from cash and sale
  proceeds return to it automatically.
- **Fixed Deposits** — a dedicated page for multiple FDs, each with its own
  principal, tenure, interest rate and interest credits.
- **Retirement** — PF and PPF balances, plus market-linked NPS units/NAV, each
  with its own page.
- **Asset details** — buy, sell, and review the full transaction history.
- **Transactions** — a single list of all entries, newest first.
- **Sync** — refresh market prices, mutual fund NAVs, and gold rates from the header.

### Physical gold

Each physical gold asset has a purity: **22K** or **24K**. When you record a
purchase, enter the weight in grams, the gold rate per gram, wastage %, and
GST %. The app shows the full invoice breakdown.

Only the gold value (rate × grams) is used for the portfolio. Wastage and GST
are recorded as buying costs and are paid from cash; they never inflate the
asset's invested or current value. XIRR uses the actual invoice total as the
purchase outflow and the latest rate × grams as the current value.

Live 22K and 24K rates are fetched from Joyalukkas' public gold-rate endpoint
(the same board rate shown for Tamil Nadu) and cached for 12 hours. The live
rate is used for today's purchase and for gold's current value in XIRR. For a
past purchase, enter the rate printed on the invoice. Rates are refreshed by
the header **Sync** button and the daily scheduler. If the provider is
unavailable, the last cached rate is kept and you can always enter the invoice
rate manually.

### Fixed deposits

Fixed deposits have their own page and are no longer managed from the Assets
tab. Add as many FDs as you need; each keeps its own principal, start date,
tenure and annual interest rate. The page shows the maturity date and a
projected maturity value using annual compounding.

- Principal is paid from Cash when the FD is created.
- Add Interest records each interest credit and grows the FD balance.
- Withdraw reduces the FD balance and credits Cash.
- FDs count in **Total Portfolio**, net worth and portfolio returns.

### Retirement accounts (PF, PPF, NPS)

PF, PPF and NPS each have their own page in the header. They are not part of
the Assets tab.

- **PF** — record contributions with the employee, employer and pension
  amounts from your EPFO passbook.
- **PPF** — a 15-year account. Add money from Cash, record the yearly interest
  on 31 March, and withdraw back to Cash. The first contribution sets the
  maturity date.
- **NPS** — tracked like a mutual fund: invest and redeem units at NAV, with
  current value = units × latest NAV.
- All three support withdrawals. PF and PPF also support interest credits.

Retirement accounts count in **net worth**, but are excluded from **Total
Portfolio** and **XIRR**. There is no PF-wage auto-calculation, VPF field or
passbook reconciliation.

PF entries do not change the Cash balance. PPF entries always move money
through Cash: adding money debits Cash and withdrawing credits it
automatically. NPS investments and redemptions can optionally move Cash. If a
PF withdrawal reaches your tracked bank/cash balance, record that separately on
the Cash page.

## Backups

Your portfolio lives in this file:

```text
backend/data/app.db
```

To make a backup, stop the app and copy that file somewhere safe:

```bash
docker compose down

# macOS / Linux
cp backend/data/app.db ~/portfolio-backup.db

# Windows PowerShell
Copy-Item .\backend\data\app.db .\portfolio-backup.db

docker compose up -d
```

You can also create a JSON export if you have the development tools installed:

```bash
cd backend
uv run python scripts/backup.py
```

## Updating

```bash
git pull
docker compose up --build -d
```

Your existing data is preserved.

## A note on security

This is a private, single-user app, but please take a few basic precautions:

- Use a strong password in `.env`.
- Never commit `.env` or share it publicly.
- If you access the app from outside `localhost`, put it behind HTTPS
  (for example with Caddy or nginx). Do not expose port `8000` directly to the
  internet.
- Back up `backend/data/app.db` regularly.

The app already includes secure session cookies, CSRF protection, login
throttling, and security headers.

## For developers

The app is built with FastAPI, SQLite, React, TypeScript, and Docker.

Run the backend and frontend separately for development:

```bash
# Terminal 1 — backend
cd backend
uv sync
uv run uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** for the development UI.

Run the tests with:

```bash
cd backend
uv run pytest
```

```bash
cd frontend
npm test
```

The Docker build runs linting, formatting, tests, and the frontend production
build before creating an image, so a failed check stops the build.

## Support the project

This project is free to use. If it has been useful to you and you would like to
say thanks, you can support WealthLedger's development with UPI:

**UPI ID:** `vimaleshbe-4@okicici`

Contributions are completely optional. Sharing the project, reporting bugs, and
suggesting improvements are just as appreciated.

## Contributing

Issues and pull requests are welcome. If you find a security issue, please
report it privately through GitHub's security advisory feature instead of
opening a public issue.

## Disclaimer

WealthLedger is a personal portfolio tracking tool, not financial advice. Always
verify your own numbers before making investment decisions.
