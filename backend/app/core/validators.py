from datetime import date, datetime


class ValidationError(ValueError):
    pass


def validate_entry_date(entry_date: str) -> None:
    try:
        parsed = datetime.strptime(entry_date, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValidationError("Invalid date format. Use YYYY-MM-DD.") from exc
    if parsed > date.today():
        raise ValidationError("Date cannot be in the future.")


def validate_positive(value: float, name: str) -> None:
    if value <= 0:
        raise ValidationError(f"{name} must be greater than zero.")
