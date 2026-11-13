from enum import Enum


class GoldPurity(str, Enum):
    K22 = "22k"
    K24 = "24k"


PURITY_LABELS: dict[GoldPurity, str] = {
    GoldPurity.K22: "22K",
    GoldPurity.K24: "24K",
}

PURITY_MARKS: dict[GoldPurity, str] = {
    GoldPurity.K22: "916",
    GoldPurity.K24: "999",
}

GOLD_RATE_SYMBOLS: dict[GoldPurity, str] = {
    GoldPurity.K22: "GOLD_22K",
    GoldPurity.K24: "GOLD_24K",
}


def parse_gold_purity(value: object) -> GoldPurity | None:
    """Parse common purity spellings into a supported gold purity."""
    if value is None:
        return None
    if isinstance(value, GoldPurity):
        return value

    text = str(value).strip().lower().replace(" ", "")
    text = text.replace("kt", "k").replace("carat", "k")
    if text in {"22", "22k", "916"}:
        return GoldPurity.K22
    if text in {"24", "24k", "999"}:
        return GoldPurity.K24
    return None


def normalize_gold_purity(value: object) -> GoldPurity:
    """Return the requested purity, defaulting to 22K for legacy records."""
    return parse_gold_purity(value) or GoldPurity.K22


def gold_purity_label(value: object) -> str:
    return PURITY_LABELS[normalize_gold_purity(value)]


def gold_rate_symbol(value: object) -> str:
    return GOLD_RATE_SYMBOLS[normalize_gold_purity(value)]


def purity_from_asset(asset: object) -> GoldPurity:
    details = getattr(asset, "details", None) or {}
    return normalize_gold_purity(details.get("purity"))
