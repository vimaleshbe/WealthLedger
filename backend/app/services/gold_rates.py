"""Live physical gold rates for Tamil Nadu.

Joyalukkas publishes its daily board rates through the same public GraphQL
endpoint used by its website. The response contains the 22K and 24K rate per
gram (before GST) for the online store. The rates are cached in the existing
``MarketDataCache`` table so normal page views never depend on the external
service.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlmodel import Session, select

from app.core.asset_types import AssetType
from app.core.gold import GoldPurity, gold_rate_symbol
from app.models import MarketDataCache

JOYALUKKAS_GRAPHQL_URL = "https://www.joyalukkas.in/graphql"
JOYALUKKAS_SOURCE = "Joyalukkas"
GOLD_STALENESS_HOURS = 12

GOLD_RATES_QUERY = """
query getgoldrates {
  getgoldrates {
    Id
    Message
    Status
    metal_rate_time
    Data {
      Id
      BRANCH_CODE
      BRANCH_NAME
      GOLD_22KT_RATE
      GOLD_24KT_RATE
    }
  }
}
"""

# The Joyalukkas storefront sends these headers with its Apollo GraphQL
# queries. The endpoint is public, but it rejects requests that look unlike
# the website.
JOYALUKKAS_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "store": "default",
    "X-Channel-Id": "WEB",
    "X-Platform": "WEB",
    "X-Device-Type": "desktop",
    "X-App-Version": "0.0.1",
    "Origin": "https://www.joyalukkas.in",
    "Referer": "https://www.joyalukkas.in/goldrate",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}


class GoldRateError(Exception):
    pass


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def is_stale(fetched_at: datetime) -> bool:
    return datetime.now(UTC) - _as_utc(fetched_at) > timedelta(
        hours=GOLD_STALENESS_HOURS
    )


def fetch_joyalukkas_gold_rates() -> dict[str, Any]:
    """Fetch the current 22K and 24K gold rate per gram from Joyalukkas."""
    try:
        response = httpx.get(
            JOYALUKKAS_GRAPHQL_URL,
            params={"query": GOLD_RATES_QUERY},
            headers=JOYALUKKAS_HEADERS,
            timeout=15.0,
        )
    except httpx.HTTPError as exc:
        raise GoldRateError(f"Could not reach Joyalukkas: {exc}") from exc

    if response.status_code != 200:
        raise GoldRateError(f"Joyalukkas returned {response.status_code}")

    try:
        payload = response.json()
        gold_rates = payload["data"]["getgoldrates"]
        rows = gold_rates.get("Data") or []
        if not rows:
            raise GoldRateError("Joyalukkas did not return any gold rates.")

        # ECM is the online store row used by the gold-rate page. Fall back
        # to the first row if Joyalukkas changes the branch code.
        row = next((item for item in rows if item.get("BRANCH_CODE") == "ECM"), rows[0])
        rates = {
            GoldPurity.K22.value: float(str(row["GOLD_22KT_RATE"]).replace(",", "")),
            GoldPurity.K24.value: float(str(row["GOLD_24KT_RATE"]).replace(",", "")),
        }
    except (KeyError, TypeError, ValueError) as exc:
        raise GoldRateError("Joyalukkas returned an unexpected response.") from exc

    if any(rate <= 0 for rate in rates.values()):
        raise GoldRateError("Joyalukkas returned an invalid gold rate.")

    return {
        "rates": rates,
        "rate_time": gold_rates.get("metal_rate_time"),
        "branch": row.get("BRANCH_NAME"),
        "source": JOYALUKKAS_SOURCE,
    }


def get_cached_gold_rate(session: Session, purity: object) -> MarketDataCache | None:
    symbol = gold_rate_symbol(purity)
    return session.exec(
        select(MarketDataCache).where(
            MarketDataCache.asset_type == AssetType.PHYSICAL_GOLD,
            MarketDataCache.symbol == symbol,
        )
    ).first()


def get_cached_gold_rates(
    session: Session,
) -> dict[GoldPurity, MarketDataCache | None]:
    return {purity: get_cached_gold_rate(session, purity) for purity in GoldPurity}


def sync_gold_rates(
    session: Session, *, force: bool = False
) -> dict[GoldPurity, MarketDataCache]:
    """Fetch and cache both supported gold rates.

    Existing cached values are reused while fresh. A failed fetch never
    deletes a previously cached rate.
    """
    cached = get_cached_gold_rates(session)
    if not force and all(
        cache is not None and not is_stale(cache.fetched_at)
        for cache in cached.values()
    ):
        return {purity: cache for purity, cache in cached.items() if cache is not None}

    snapshot = fetch_joyalukkas_gold_rates()
    now = datetime.now(UTC)
    result: dict[GoldPurity, MarketDataCache] = {}

    for purity in GoldPurity:
        symbol = gold_rate_symbol(purity)
        price = float(snapshot["rates"][purity.value])
        cache = cached.get(purity)
        if cache:
            cache.price = price
            cache.fetched_at = now
            cache.source = snapshot["source"]
        else:
            cache = MarketDataCache(
                asset_type=AssetType.PHYSICAL_GOLD,
                symbol=symbol,
                price=price,
                fetched_at=now,
                source=snapshot["source"],
            )
            session.add(cache)
        result[purity] = cache

    session.commit()
    for cache in result.values():
        session.refresh(cache)
    return result
