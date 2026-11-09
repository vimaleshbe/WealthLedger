---
name: Portfolio Data Safety
description: Use when touching SQLite data, backups, restore, tests, or any operation that could modify user portfolio data.
---

# Portfolio Data Safety

## Never modify or delete user data

- Live database: `backend/data/app.db`
- User backup: `backend/portfolio_backup.json`

Treat both as production data. Do not reset, delete, overwrite, seed, or restore over them.

Do not run destructive commands such as:

- deleting `backend/data` or `backend/data/app.db`
- `docker compose down -v`
- `restore.py` against the live database
- bulk update/delete SQL against `app.db`

## Testing

- Use a throwaway copy, for example:
  ```bash
  copy backend\data\app.db backend\data\test.db
  ```
  Then run with `DATABASE_URL=sqlite:///./data/test.db` from `backend/`.
- Delete the throwaway DB after testing.
- Never add demo or seed assets to the live database.

## Docker

The production container bind-mounts the live data:

```yaml
volumes:
  - ./backend/data:/app/data
```

Inside the container the DB is `/app/data/app.db`. Use four slashes for an absolute SQLite URL:

```text
DATABASE_URL=sqlite:////app/data/app.db
```

Stop the container before inspecting or copying the DB from the host if the file appears locked.

## Backup and restore

Run from `backend/` against the live database, intentionally:

```bash
uv run python scripts/backup.py     # writes portfolio_backup.json
uv run python scripts/restore.py    # REPLACES current data — ask first
```

Never run restore without explicit user confirmation.
