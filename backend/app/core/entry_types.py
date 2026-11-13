from enum import Enum


class EntryType(str, Enum):
    BUY = "buy"
    SELL = "sell"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    # Interest grows a balance without being new invested capital.
    INTEREST = "interest"
