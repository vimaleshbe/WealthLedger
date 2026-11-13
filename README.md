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
- See portfolio, equity, and gold returns as both CAGR and XIRR
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
- **Assets** — add or edit stocks, mutual funds, fixed deposits, liquid and
  arbitrage funds, PPF, PF, bank balances, gold, real estate, and more.
- **Cash** — add or withdraw money. Purchases are paid from cash and sale
  proceeds return to it automatically.
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
