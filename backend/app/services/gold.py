"""Physical gold purchase calculations.

A gold purchase invoice has three parts:

* gold value — rate per gram multiplied by the weight
* wastage — a percentage of the gold value charged by the jeweller
* GST — a percentage of the gold value plus wastage

The portfolio only counts the gold value. Wastage and GST are buying costs
that are paid from cash, so they are stored on the entry for transparency but
never become part of the asset's invested value.
"""

from dataclasses import dataclass


class GoldDetailsError(ValueError):
    pass


@dataclass(frozen=True)
class GoldPurchaseBreakdown:
    grams: float
    price_per_gram: float
    wastage_percent: float
    gst_percent: float
    gold_value: float
    wastage_amount: float
    gst_amount: float
    total_paid: float

    def as_entry_details(self) -> dict[str, float]:
        return {
            "gold_price_per_gram": round(self.price_per_gram, 2),
            "gold_value": self.gold_value,
            "wastage_percent": round(self.wastage_percent, 3),
            "wastage_amount": self.wastage_amount,
            "gst_percent": round(self.gst_percent, 3),
            "gst_amount": self.gst_amount,
            "total_paid": self.total_paid,
        }


def _number(value: object, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise GoldDetailsError(f"{label} must be a number.") from exc
    if number != number or number in (float("inf"), float("-inf")):
        raise GoldDetailsError(f"{label} must be a number.")
    return number


def _non_negative(value: object, label: str) -> float:
    number = _number(value, label)
    if number < 0:
        raise GoldDetailsError(f"{label} cannot be negative.")
    return number


def calculate_gold_purchase(
    grams: float, details: dict | None
) -> GoldPurchaseBreakdown | None:
    """Calculate a gold purchase from its explicit invoice details.

    Returns ``None`` when the details do not contain a gold rate, which keeps
    older entries that only stored a total value working unchanged.
    """
    if not details or details.get("gold_price_per_gram") in (None, ""):
        return None

    price_per_gram = _number(details.get("gold_price_per_gram"), "Gold price")
    if price_per_gram <= 0:
        raise GoldDetailsError("Gold price must be greater than zero.")

    wastage_percent = _non_negative(details.get("wastage_percent", 0), "Wastage")
    gst_percent = _non_negative(details.get("gst_percent", 0), "GST")

    gold_value = round(grams * price_per_gram, 2)
    wastage_amount = round(gold_value * wastage_percent / 100, 2)
    gst_amount = round((gold_value + wastage_amount) * gst_percent / 100, 2)
    total_paid = round(gold_value + wastage_amount + gst_amount, 2)

    return GoldPurchaseBreakdown(
        grams=grams,
        price_per_gram=price_per_gram,
        wastage_percent=wastage_percent,
        gst_percent=gst_percent,
        gold_value=gold_value,
        wastage_amount=wastage_amount,
        gst_amount=gst_amount,
        total_paid=total_paid,
    )
