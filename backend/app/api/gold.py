from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.gold import GoldPurity
from app.db import get_session
from app.schemas import GoldRateItem, GoldRatesResponse
from app.services.gold_rates import (
    GoldRateError,
    get_cached_gold_rates,
    is_stale,
    sync_gold_rates,
)

router = APIRouter(prefix="/gold", tags=["gold"])


@router.get("/rates", response_model=GoldRatesResponse)
def gold_rates(
    refresh: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> GoldRatesResponse:
    """Return the latest 22K and 24K rate per gram.

    Rates are served from the cache. They are fetched from Joyalukkas when a
    value is missing or when ``refresh=true`` is passed.
    """
    caches = get_cached_gold_rates(session)

    if refresh or any(
        cache is None or is_stale(cache.fetched_at) for cache in caches.values()
    ):
        try:
            caches = sync_gold_rates(session, force=refresh)
        except GoldRateError as exc:
            if all(cache is None for cache in caches.values()):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Could not fetch gold rates from Joyalukkas. "
                        "Enter the rate manually."
                    ),
                ) from exc

    rates: dict[str, GoldRateItem | None] = {}
    for purity in GoldPurity:
        cache = caches.get(purity)
        rates[purity.value] = (
            GoldRateItem(
                price_per_gram=cache.price,
                source=cache.source,
                fetched_at=cache.fetched_at,
                stale=is_stale(cache.fetched_at),
            )
            if cache
            else None
        )

    return GoldRatesResponse(rates=rates)
