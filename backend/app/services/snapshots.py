from collections import defaultdict

from sqlmodel import Session, select

from app.models import AssetEntry, PortfolioSnapshot


def recalculate_snapshots(session: Session) -> None:
    """Rebuild portfolio snapshots from asset entries.

    Each snapshot reflects the cumulative value of all entries up to and
    including that date, summing multiple entries (SIPs) per asset.
    """
    session.exec(PortfolioSnapshot.__table__.delete())

    entries = session.exec(
        select(AssetEntry).order_by(AssetEntry.asset_id, AssetEntry.date)
    ).all()

    # Cumulative value per asset as we walk forward in time.
    asset_values: dict[int, float] = defaultdict(float)
    date_events: dict[str, list[tuple[int, float]]] = defaultdict(list)

    for entry in entries:
        date_events[entry.date].append((entry.asset_id, entry.value))

    snapshots: dict[str, float] = {}
    for snapshot_date in sorted(date_events.keys()):
        for asset_id, value in date_events[snapshot_date]:
            asset_values[asset_id] += value
        snapshots[snapshot_date] = sum(asset_values.values())

    for snapshot_date, total in sorted(snapshots.items()):
        session.add(PortfolioSnapshot(date=snapshot_date, total_value=total))

    session.commit()


def get_portfolio_value(session: Session) -> float:
    """Return the latest total portfolio value."""
    latest = session.exec(
        select(PortfolioSnapshot).order_by(PortfolioSnapshot.date.desc())
    ).first()
    return latest.total_value if latest else 0.0
