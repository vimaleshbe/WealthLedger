import json
import sys
from datetime import datetime
from pathlib import Path

# Make app importable when running from scripts/ directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select

from app.db import engine
from app.models import Asset, AssetEntry, MarketDataCache, PortfolioSnapshot


def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def backup_database(path: str = "portfolio_backup.json") -> None:
    with Session(engine) as session:
        assets = session.exec(select(Asset)).all()
        entries = session.exec(select(AssetEntry)).all()
        snapshots = session.exec(select(PortfolioSnapshot)).all()
        market_data = session.exec(select(MarketDataCache)).all()

    data = {
        "backup_at": datetime.now().isoformat(),
        "assets": [a.model_dump() for a in assets],
        "asset_entries": [e.model_dump() for e in entries],
        "portfolio_snapshots": [s.model_dump() for s in snapshots],
        "market_data_cache": [m.model_dump() for m in market_data],
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=serialize)

    print(f"Backup written to {path}")
    print(f"Assets: {len(data['assets'])}")
    print(f"Entries: {len(data['asset_entries'])}")
    print(f"Snapshots: {len(data['portfolio_snapshots'])}")
    print(f"Market data: {len(data['market_data_cache'])}")


if __name__ == "__main__":
    backup_database()
