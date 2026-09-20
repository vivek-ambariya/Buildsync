"""Date helpers. Mongo stores datetimes, the API speaks ISO dates."""
from datetime import date, datetime, time, timezone


def to_datetime(value: date | datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def days_between(start: datetime | None, end: datetime | None) -> int:
    if not start or not end:
        return 0
    return (end.date() - start.date()).days


def elapsed_fraction(start: datetime | None, end: datetime | None, now: datetime | None = None) -> float:
    """How far through its schedule a project should be, as 0..1."""
    now = now or datetime.now(timezone.utc)
    if not start or not end:
        return 0.0
    total = (end - start).total_seconds()
    if total <= 0:
        return 1.0
    return max(0.0, min(1.0, (now - start).total_seconds() / total))
