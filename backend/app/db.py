from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=settings.environment == "development",
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate_asset_entry_table()


def _migrate_asset_entry_table() -> None:
    """Apply additive ledger columns to an existing SQLite database.

    ``create_all`` only creates missing tables, so older installations need a
    small in-place migration. The old unique constraint on (asset_id, date)
    is also removed because a buy and a sell can now happen on the same day.
    All existing rows are preserved; legacy entries default to a purchase
    that does not move cash.
    """
    with engine.begin() as conn:
        row = conn.exec_driver_sql(
            "SELECT sql FROM sqlite_master "
            "WHERE type = 'table' AND name = 'asset_entry'"
        ).fetchone()
        if not row:
            return

        table_sql = row[0] or ""
        columns = {
            column[1]
            for column in conn.exec_driver_sql("PRAGMA table_info(asset_entry)")
        }

        if "entry_type" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE asset_entry "
                "ADD COLUMN entry_type VARCHAR(10) NOT NULL DEFAULT 'BUY'"
            )
        if "affects_cash" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE asset_entry "
                "ADD COLUMN affects_cash BOOLEAN NOT NULL DEFAULT 0"
            )
        if "cash_value" not in columns:
            conn.exec_driver_sql("ALTER TABLE asset_entry ADD COLUMN cash_value FLOAT")

        if "uix_asset_date" not in table_sql:
            return

        from app.models import AssetEntry

        conn.exec_driver_sql("DROP INDEX IF EXISTS ix_asset_entry_asset_id")
        conn.exec_driver_sql("DROP INDEX IF EXISTS ix_asset_entry_date")
        conn.exec_driver_sql("ALTER TABLE asset_entry RENAME TO asset_entry_legacy")
        AssetEntry.__table__.create(bind=conn)
        conn.exec_driver_sql(
            "INSERT INTO asset_entry "
            "(id, asset_id, date, value, units, entry_type, affects_cash, "
            "cash_value, notes, created_at, updated_at) "
            "SELECT id, asset_id, date, value, units, entry_type, affects_cash, "
            "cash_value, notes, created_at, updated_at "
            "FROM asset_entry_legacy"
        )
        conn.exec_driver_sql("DROP TABLE asset_entry_legacy")


def get_session() -> Session:
    with Session(engine) as session:
        yield session
