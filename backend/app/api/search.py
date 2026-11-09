from typing import Literal

from fastapi import APIRouter, Query

from app.services.search import search_mfapi_schemes, search_yahoo_stocks

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(
    query: str = Query(..., min_length=1),
    type: Literal["stock", "mutual_fund"] = Query(...),
) -> dict[str, list[dict[str, str]]]:
    if type == "stock":
        return {"results": search_yahoo_stocks(query)}
    return {"results": search_mfapi_schemes(query)}
