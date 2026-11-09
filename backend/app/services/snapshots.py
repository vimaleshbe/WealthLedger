from collections import defaultdict

from sqlmodel import Session, select

from app.models import AssetEntry, PortfolioSnapshot
from app.services.cash import entry_net_worth_effect


def recalculate_snapshots(session: Session) -> None:
    """Rebuild portfolio snapshots from asset entries.

    Each snapshot reflects the cumulative net-worth effect of every entry up
    to and including that date. Purchases paid from cash leave net worth
    unchanged, while deposits and realised gains increase it.
    """
    session.exec(PortfolioSnapshot.__table__.delete())

    entries = session.exec(
        select(AssetEntry).order_by(AssetEntry.asset_id, AssetEntry.date)
    ).all()

    date_events: dict[str, float] = defaultdict(float)
    for entry in entries:
        date_events[entry.date] += entry_net_worth_effect(entry)

    snapshots: dict[str, float] = {}
    running_total = 0.0
    for snapshot_date in sorted(date_events.keys()):
        running_total += date_events[snapshot_date]
        snapshots[snapshot_date] = running_total

    for snapshot_date, total in sorted(snapshots.items()):
        session.add(PortfolioSnapshot(date=snapshot_date, total_value=total))

    session.commit()


def get_portfolio_value(session: Session) -> float:
    """Return the latest total portfolio value."""
    latest = session.exec(
        select(PortfolioSnapshot).order_by(PortfolioSnapshot.date.desc())
    ).first()
    return latest.total_value if latest else 0.0
