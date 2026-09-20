"""Number formatting shared by the report and assistant text generators."""


def format_inr(amount: float) -> str:
    """Indian numbering: crore / lakh, matching how budgets are quoted on site."""
    if amount is None:
        return "-"
    crore = 10_000_000
    lakh = 100_000
    if abs(amount) >= crore:
        return f"₹{amount / crore:.2f} Cr"
    if abs(amount) >= lakh:
        return f"₹{amount / lakh:.2f} L"
    return f"₹{amount:,.0f}"


def pct(value: float, digits: int = 0) -> str:
    return f"{value:.{digits}f}%"


def signed_pct(value: float, digits: int = 0) -> str:
    return f"{value:+.{digits}f}%"


def format_date(value) -> str:
    """"2028-06-24" -> "24 Jun 2028". Site staff do not read ISO dates."""
    from datetime import date, datetime

    if value is None:
        return "-"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, (datetime, date)):
        return value.strftime("%d %b %Y")
    return str(value)
