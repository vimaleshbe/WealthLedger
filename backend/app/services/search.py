from typing import Any

import httpx


def search_yahoo_stocks(query: str) -> list[dict[str, Any]]:
    """Search NSE/BSE stocks via Yahoo Finance."""
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {
        "q": query,
        "quotesCount": 10,
        "newsCount": 0,
        "listsCount": 0,
        "enableFuzzyQuery": "false",
    }
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        response = httpx.get(url, params=params, headers=headers, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return []
    data = response.json()
    results: list[dict[str, Any]] = []
    for quote in data.get("quotes", []):
        symbol = quote.get("symbol", "")
        exchange = quote.get("exchange", "")
        if (
            symbol.endswith(".NS")
            or symbol.endswith(".BO")
            or exchange in ("NSI", "BSE")
        ):
            results.append(
                {
                    "symbol": symbol,
                    "name": quote.get("longname") or quote.get("shortname", ""),
                    "exchange": exchange,
                    "type": "stock",
                }
            )
    return results


def search_mfapi_schemes(query: str) -> list[dict[str, Any]]:
    """Search Indian mutual fund schemes via MFAPI.in."""
    url = "https://api.mfapi.in/mf"
    try:
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError:
        return []
    schemes = response.json()
    query_lower = query.lower()
    results: list[dict[str, Any]] = []
    for scheme in schemes:
        name = scheme.get("schemeName", "")
        code = scheme.get("schemeCode", "")
        if query_lower in name.lower() or query_lower in str(code):
            results.append(
                {
                    "symbol": str(code),
                    "name": name,
                    "type": "mutual_fund",
                }
            )
        if len(results) >= 10:
            break
    return results
