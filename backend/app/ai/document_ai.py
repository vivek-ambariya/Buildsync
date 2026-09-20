"""Document intelligence pipeline.

A document goes through four stages: read -> classify -> extract -> normalise.
Each stage is a plain function, and extractors are registered per document
type, so a new format (say, a structural drawing schedule) is one function and
one registry entry. When a hosted model is configured the extract stage can
defer to it; otherwise the deterministic parsers below do the work.
"""
from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, timezone
from typing import Callable

from app.ai.llm_provider import get_provider
from app.models.common import DocumentType

# Rates and quantities as they appear in Indian BOQs and invoices.
_NUM = r"[-+]?[\d,]*\.?\d+"
_CURRENCY = re.compile(rf"(?:rs\.?|inr|₹)\s*({_NUM})", re.IGNORECASE)
# The captured reference must contain a digit, otherwise the word "Invoice"
# in a heading gets picked up as the invoice number.
_INVOICE_NO = re.compile(
    r"(?:invoice|bill|inv)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z]{0,5}[-/]?\d[A-Z0-9/-]{2,})",
    re.IGNORECASE,
)
_DATE = re.compile(r"(\d{1,2}[-/][A-Za-z0-9]{2,9}[-/]\d{2,4})")
_GST = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d])\b")

UNITS = ["cum", "sqm", "rmt", "nos", "kg", "ton", "tonne", "tons", "bags", "ltr", "mt", "sqft", "cft"]


# --------------------------------------------------------------------------
# Stage 1 - read
# --------------------------------------------------------------------------

def read_document(raw: bytes, filename: str) -> str:
    """Decode a document to text. Binary formats degrade gracefully."""
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix in {"csv", "txt", "tsv", "md", "json"}:
        return raw.decode("utf-8", errors="replace")
    if suffix == "pdf":
        # Extract any embedded text streams without a heavy PDF dependency.
        text = raw.decode("latin-1", errors="replace")
        chunks = re.findall(r"\((.*?)\)\s*Tj", text)
        return "\n".join(chunks) if chunks else ""
    return raw.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------
# Stage 2 - classify
# --------------------------------------------------------------------------

_SIGNALS: dict[str, list[str]] = {
    DocumentType.boq.value: ["bill of quantities", "boq", "item description", "sor", "schedule of rates"],
    DocumentType.invoice.value: ["invoice", "tax invoice", "gstin", "bill to", "amount payable"],
    DocumentType.contract.value: ["agreement", "hereinafter", "party of the first part", "scope of work", "clause"],
    DocumentType.site_report.value: ["site report", "daily progress", "manpower", "weather", "work executed"],
    DocumentType.drawing.value: ["drawing no", "scale 1:", "plan view", "section a-a", "revision"],
}


def classify(text: str, filename: str) -> tuple[str, float]:
    haystack = f"{filename}\n{text[:4000]}".lower()
    scores = {
        doc_type: sum(1 for signal in signals if signal in haystack)
        for doc_type, signals in _SIGNALS.items()
    }
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return DocumentType.other.value, 0.3
    confidence = min(0.98, 0.55 + 0.12 * scores[best])
    return best, round(confidence, 2)


# --------------------------------------------------------------------------
# Stage 3 - extract
# --------------------------------------------------------------------------

def _to_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _tabular_rows(text: str) -> list[list[str]]:
    """Read delimited rows, whether the file is comma, tab or pipe separated."""
    sample = text[:2000]
    delimiter = max([",", "\t", "|", ";"], key=sample.count)
    if sample.count(delimiter) < 2:
        return []
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    return [[cell.strip() for cell in row] for row in reader if any(cell.strip() for cell in row)]


def extract_boq(text: str) -> dict:
    """Pull the priced line items out of a bill of quantities."""
    rows = _tabular_rows(text)
    items: list[dict] = []

    if rows:
        header = [h.lower() for h in rows[0]]
        def col(*names: str) -> int | None:
            for name in names:
                for idx, head in enumerate(header):
                    if name in head:
                        return idx
            return None

        idx_desc = col("description", "item", "material", "particular")
        idx_qty = col("quantity", "qty")
        idx_unit = col("unit", "uom")
        idx_rate = col("rate", "price")
        idx_amount = col("amount", "total", "value")
        idx_vendor = col("vendor", "supplier")

        for row in rows[1:]:
            if idx_desc is None or idx_desc >= len(row) or not row[idx_desc]:
                continue
            qty = _to_float(row[idx_qty]) if idx_qty is not None and idx_qty < len(row) else None
            rate = _to_float(row[idx_rate]) if idx_rate is not None and idx_rate < len(row) else None
            amount = _to_float(row[idx_amount]) if idx_amount is not None and idx_amount < len(row) else None
            if amount is None and qty is not None and rate is not None:
                amount = round(qty * rate, 2)
            items.append({
                "material": row[idx_desc],
                "quantity": qty,
                "unit": row[idx_unit] if idx_unit is not None and idx_unit < len(row) else None,
                "rate": rate,
                "amount": amount,
                "vendor": row[idx_vendor] if idx_vendor is not None and idx_vendor < len(row) else None,
            })

    if not items:
        # Unstructured fallback: "Item  qty unit  rate  amount" on one line.
        pattern = re.compile(
            rf"^(?P<desc>[A-Za-z][A-Za-z0-9 ,./()-]{{3,60}}?)\s+(?P<qty>{_NUM})\s*"
            rf"(?P<unit>{'|'.join(UNITS)})?\s+(?P<rate>{_NUM})\s+(?P<amount>{_NUM})\s*$",
            re.IGNORECASE | re.MULTILINE,
        )
        for match in pattern.finditer(text):
            items.append({
                "material": match.group("desc").strip(),
                "quantity": _to_float(match.group("qty")),
                "unit": (match.group("unit") or "").lower() or None,
                "rate": _to_float(match.group("rate")),
                "amount": _to_float(match.group("amount")),
                "vendor": None,
            })

    total = sum(i["amount"] for i in items if i.get("amount"))
    return {
        "line_items": items,
        "fields": {
            "Line items": str(len(items)),
            "Total value": f"₹{total:,.2f}" if total else "Not stated",
            "Priced items": str(sum(1 for i in items if i.get("rate"))),
        },
        "total_value": round(total, 2),
    }


def extract_invoice(text: str) -> dict:
    amounts = [_to_float(m) for m in _CURRENCY.findall(text)]
    amounts = [a for a in amounts if a is not None]
    invoice_no = _INVOICE_NO.search(text)
    doc_date = _DATE.search(text)
    gstin = _GST.search(text)

    vendor = None
    for line in text.splitlines()[:12]:
        stripped = line.strip()
        if len(stripped) > 3 and not any(c.isdigit() for c in stripped) and "invoice" not in stripped.lower():
            vendor = stripped
            break

    boq = extract_boq(text)
    total = max(amounts) if amounts else boq["total_value"]

    return {
        "line_items": boq["line_items"],
        "fields": {
            "Vendor": vendor or "Not detected",
            "Invoice number": invoice_no.group(1) if invoice_no else "Not detected",
            "Invoice date": doc_date.group(1) if doc_date else "Not detected",
            "GSTIN": gstin.group(1) if gstin else "Not detected",
            "Total amount": f"₹{total:,.2f}" if total else "Not detected",
        },
        "total_value": round(total or 0, 2),
    }


def extract_site_report(text: str) -> dict:
    workers = re.search(r"(?:manpower|workers?|labour)\D{0,12}(\d{1,4})", text, re.IGNORECASE)
    progress = re.search(rf"(?:progress|completion)\D{{0,12}}({_NUM})\s*%", text, re.IGNORECASE)
    weather = re.search(r"weather\s*[:\-]?\s*([A-Za-z ]{3,20})", text, re.IGNORECASE)
    return {
        "line_items": [],
        "fields": {
            "Workers on site": workers.group(1) if workers else "Not stated",
            "Reported progress": f"{progress.group(1)}%" if progress else "Not stated",
            "Weather": weather.group(1).strip() if weather else "Not stated",
        },
        "total_value": 0.0,
    }


def extract_generic(text: str) -> dict:
    amounts = [a for a in (_to_float(m) for m in _CURRENCY.findall(text)) if a is not None]
    words = len(text.split())
    return {
        "line_items": [],
        "fields": {
            "Word count": str(words),
            "Values found": str(len(amounts)),
            "Largest value": f"₹{max(amounts):,.2f}" if amounts else "None",
        },
        "total_value": round(max(amounts), 2) if amounts else 0.0,
    }


EXTRACTORS: dict[str, Callable[[str], dict]] = {
    DocumentType.boq.value: extract_boq,
    DocumentType.invoice.value: extract_invoice,
    DocumentType.site_report.value: extract_site_report,
    DocumentType.contract.value: extract_generic,
    DocumentType.drawing.value: extract_generic,
    DocumentType.other.value: extract_generic,
}

_LLM_SYSTEM = (
    "You extract structured data from Indian construction documents. "
    "Reply with JSON only: {\"fields\": {label: value}, \"line_items\": "
    "[{\"material\", \"quantity\", \"unit\", \"rate\", \"amount\", \"vendor\"}]}."
)


async def extract(text: str, doc_type: str) -> dict:
    """Run the extractor for this document type, preferring a hosted model."""
    provider = get_provider()
    if provider.available and text.strip():
        try:
            reply = await provider.complete(_LLM_SYSTEM, text[:12000], max_tokens=1500)
            payload = json.loads(re.search(r"\{.*\}", reply, re.DOTALL).group(0))
            payload.setdefault("line_items", [])
            payload.setdefault("fields", {})
            payload["total_value"] = sum(
                float(i.get("amount") or 0) for i in payload["line_items"]
            )
            payload["extractor"] = provider.name
            return payload
        except Exception:
            pass  # a model failure must never lose the document

    result = EXTRACTORS.get(doc_type, extract_generic)(text)
    result["extractor"] = "rules"
    return result


# --------------------------------------------------------------------------
# Stage 4 - normalise
# --------------------------------------------------------------------------

async def process(raw: bytes, filename: str, declared_type: str | None = None) -> dict:
    text = read_document(raw, filename)
    detected_type, confidence = classify(text, filename)
    doc_type = declared_type or detected_type
    extraction = await extract(text, doc_type)

    return {
        "doc_type": doc_type,
        "detected_type": detected_type,
        "classification_confidence": confidence,
        "extracted_fields": extraction.get("fields", {}),
        "line_items": extraction.get("line_items", [])[:200],
        "total_value": extraction.get("total_value", 0.0),
        "extractor": extraction.get("extractor", "rules"),
        "text_preview": text[:800],
        "processed_at": datetime.now(timezone.utc),
    }
