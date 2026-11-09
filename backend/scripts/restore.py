import json
import sys
from datetime import datetime
from pathlib import Path

# Make app importable when running from scripts/ directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session

from app.core.entry_types import EntryType
from app.db import engine
from app.models import Asset, AssetEntry, MarketDataCache, PortfolioSnapshot


def parse_datetime(value):
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    return value


def restore_database(path: str = "portfolio_backup.json") -> None:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    with Session(engine) as session:
        # Clear existing data in reverse dependency order
        session.exec(MarketDataCache.__table__.delete())
        session.exec(PortfolioSnapshot.__table__.delete())
        session.exec(AssetEntry.__table__.delete())
        session.exec(Asset.__table__.delete())

        # Restore assets
        for item in data.get("assets", []):
            asset = Asset(
                id=item["id"],
                name=item["name"],
                asset_type=item["asset_type"],
                category=item["category"],
                symbol=item.get("symbol"),
                details=item.get("details"),
                notes=item.get("notes"),
                created_at=parse_datetime(item["created_at"]),
                updated_at=parse_datetime(item["updated_at"]),
            )
            session.add(asset)

        # Restore entries
        for item in data.get("asset_entries", []):
            entry = AssetEntry(
                id=item["id"],
                asset_id=item["asset_id"],
                date=item["date"],
                value=item["value"],
                units=item["units"],
                entry_type=EntryType(str(item.get("entry_type", "buy")).lower()),
                affects_cash=item.get("affects_cash", False),
                cash_value=item.get("cash_value"),
                notes=item.get("notes"),
                created_at=parse_datetime(item["created_at"]),
                updated_at=parse_datetime(item["updated_at"]),
            )
            session.add(entry)

        # Restore snapshots
        for item in data.get("portfolio_snapshots", []):
            snapshot = PortfolioSnapshot(
                id=item["id"],
                date=item["date"],
                total_value=item["total_value"],
                created_at=parse_datetime(item["created_at"]),
                updated_at=parse_datetime(item["updated_at"]),
            )
            session.add(snapshot)

        # Restore market data cache
        for item in data.get("market_data_cache", []):
            cache = MarketDataCache(
                id=item["id"],
                asset_type=item["asset_type"],
                symbol=item["symbol"],
                price=item["price"],
                fetched_at=parse_datetime(item["fetched_at"]),
                source=item["source"],
                created_at=parse_datetime(item["created_at"]),
            )
            session.add(cache)

        session.commit()

    print(f"Restored from {path}")
    print(f"Assets: {len(data.get('assets', []))}")
    print(f"Entries: {len(data.get('asset_entries', []))}")
    print(f"Snapshots: {len(data.get('portfolio_snapshots', []))}")
    print(f"Market data: {len(data.get('market_data_cache', []))}")


if __name__ == "__main__":
    restore_database()
