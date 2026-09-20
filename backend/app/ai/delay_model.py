"""The trained delay classifier, applied to live project data.

`ml/train_model.py` fits a calibrated logistic regression on ten features and
saves it, with its feature order and tuned decision threshold, as a joblib
bundle. This module is the only thing that loads that bundle: it turns a real
project into the ten features the model was trained on, and returns the
probability the model gives.

Two rules hold throughout:

  * If the bundle is missing or fails to load, every call returns `None`. The
    API then reports that no prediction is available. A made-up percentage
    beside a real one is worse than no percentage at all.
  * Derived features are clamped to the range the model actually saw in
    training. A logistic regression will happily extrapolate to a confident
    answer for a project 400 days past its deadline, and that answer would be
    unsupported. Clamping keeps every prediction inside the model's evidence,
    and `clamped` on the result says when it happened.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.utils.dates import to_datetime

log = logging.getLogger(__name__)

# The interval each feature covered in the training set, from
# ml/data/buildsync_construction_delay_dataset.csv. Used to keep live inputs
# inside the model's support rather than to validate them.
TRAINING_RANGES: dict[str, tuple[float, float]] = {
    "planned_duration_days": (30.0, 365.0),
    "elapsed_days": (5.0, 344.0),
    "progress_variance_pct": (-40.0, 20.0),
    "material_availability_pct": (40.0, 100.0),
    "material_delay_days": (0.0, 20.0),
    "labor_count": (5.0, 100.0),
    "previous_delay_count": (0.0, 8.0),
    "budget_variance_pct": (-10.0, 30.0),
    "deadline_days_remaining": (1.0, 180.0),
    "task_completion_rate_pct": (0.0, 100.0),
}

BAND_HIGH = 0.60
BAND_MEDIUM = 0.35


@lru_cache(maxsize=1)
def _bundle() -> dict[str, Any] | None:
    path = settings.delay_model_file
    if not path or not Path(path).exists():
        log.warning("Delay model not found at %s; risk scores will be unavailable.", path)
        return None
    try:
        import joblib

        bundle = joblib.load(path)
    except Exception as exc:
        log.warning("Could not load the delay model at %s: %s", path, exc)
        return None

    if not isinstance(bundle, dict) or "model" not in bundle or "feature_names" not in bundle:
        log.warning("The delay model bundle at %s is not in the expected shape.", path)
        return None
    return bundle


def available() -> bool:
    return _bundle() is not None


def model_info() -> dict:
    """What the client can say about the model on screen, without predicting."""
    bundle = _bundle()
    if bundle is None:
        return {"available": False}
    # `test_metrics` holds the tuned-threshold scores directly, as a flat dict
    # of accuracy/precision/recall/roc_auc. (metrics.json nests them one level
    # deeper; the bundle does not.)
    scores = bundle.get("test_metrics") or {}
    return {
        "available": True,
        "name": bundle.get("model_name"),
        "threshold": round(float(bundle.get("threshold") or 0.5), 3),
        "trained_on_rows": bundle.get("trained_on_rows"),
        "features": list(bundle.get("feature_names") or []),
        "roc_auc": _score(scores, "roc_auc"),
        "precision": _score(scores, "precision"),
        "recall": _score(scores, "recall"),
        "accuracy": _score(scores, "accuracy"),
        "top_features": _top_features(bundle, 5),
    }


def _score(scores: dict, key: str) -> float | None:
    """One metric as a plain float; the bundle stores some as numpy scalars."""
    value = scores.get(key)
    return round(float(value), 3) if value is not None else None


def _top_features(bundle: dict, limit: int) -> list[dict]:
    importance = bundle.get("shap_importance") or {}
    ranked = sorted(importance.items(), key=lambda pair: -abs(float(pair[1])))[:limit]
    direction = bundle.get("feature_direction") or {}
    return [
        {"feature": name, "importance": round(float(value), 4), "direction": direction.get(name)}
        for name, value in ranked
    ]


def build_features(
    project: dict,
    *,
    schedule: dict,
    budget: dict,
    tasks: list[dict],
    materials: list[dict],
    site_updates: list[dict],
) -> dict[str, float]:
    """Map one project's real records onto the model's ten training features."""
    start = to_datetime(project.get("start_date"))
    end = to_datetime(project.get("end_date"))

    planned_duration = float(schedule.get("total_days") or 0)
    if start and end:
        planned_duration = float(max(1, (end - start).days))

    elapsed = float(schedule.get("elapsed_days") or 0)
    remaining = planned_duration - elapsed
    if end:
        from app.ai.engine import _now

        remaining = float((end - _now()).days)

    duration, elapsed, remaining = _harmonise_timeline(planned_duration, elapsed, remaining)

    completed = sum(1 for t in tasks if t.get("status") == "completed")
    completion_rate = (completed / len(tasks) * 100) if tasks else 0.0

    # Tasks the site has already let slip: the closest real signal to the
    # training set's count of prior delay events on a project.
    delayed_tasks = sum(1 for t in tasks if t.get("status") == "delayed")

    availability, material_delay = _material_features(materials, schedule)

    # Headcount comes from the most recent site report that actually recorded
    # one; an unfilled field is not a site with nobody on it.
    labour = next(
        (float(u["workers_count"]) for u in reversed(site_updates or [])
         if u.get("workers_count")),
        0.0,
    )

    return {
        "planned_duration_days": duration,
        "elapsed_days": elapsed,
        "progress_variance_pct": float(schedule.get("variance") or 0),
        "material_availability_pct": availability,
        "material_delay_days": material_delay,
        "labor_count": labour,
        "previous_delay_count": float(delayed_tasks),
        "budget_variance_pct": float(budget.get("overrun_percent") or 0),
        "deadline_days_remaining": remaining,
        "task_completion_rate_pct": round(completion_rate, 1),
    }


def _harmonise_timeline(duration: float, elapsed: float, remaining: float) -> tuple[float, float, float]:
    """Put a project's timeline on the scale the model was trained on.

    The training set covers builds of 30-365 days. Real BuildSync projects run
    to 800, and the three timeline features have to stay consistent with each
    other: feeding a 760-day duration alongside a 158-day remainder describes a
    project the model never saw, and clamping each feature on its own describes
    one that cannot exist.

    So the timeline is rescaled rather than truncated. The duration is capped
    into the supported range, and elapsed/remaining are re-expressed as the
    same *fractions* of that capped span. A 760-day build 57% of the way
    through becomes a 365-day build 57% of the way through — which is the
    thing the model actually learned to score, since where a project sits in
    its own lifecycle is what drives delay, not the absolute day count.
    """
    duration = max(1.0, duration)
    span = max(1.0, elapsed + max(0.0, remaining))
    low, high = TRAINING_RANGES["planned_duration_days"]
    scaled_duration = max(low, min(high, duration))

    elapsed_fraction = max(0.0, min(1.0, elapsed / span))
    return (
        round(scaled_duration, 1),
        round(scaled_duration * elapsed_fraction, 1),
        round(scaled_duration * (1.0 - elapsed_fraction), 1),
    )


def _material_features(materials: list[dict], schedule: dict) -> tuple[float, float]:
    """Stock health for one project: % of lines adequately stocked, worst lead time.

    "Availability" here is the share of material lines carrying enough cover to
    outlast a replacement order, which is what the training feature measured.
    It is deliberately not `available_qty / required_qty`: materials arrive in
    staged deliveries, so a well-run site mid-build holds a few weeks of stock
    against a whole-project quantity and that ratio reads as 3% on every
    project, healthy or not.
    """
    if not materials:
        # No material register is not a shortage, so it should not read as one.
        return 100.0, 0.0

    from app.ai.engine import material_metrics

    elapsed = int(schedule.get("elapsed_days") or 1)
    healthy = 0
    exposure = 0.0
    for material in materials:
        metrics = material_metrics(material, elapsed)
        if metrics.get("status") == "healthy":
            healthy += 1
        elif metrics.get("status") == "critical":
            # This line runs dry before a reorder could land, so the site is
            # exposed for the length of its lead time.
            exposure = max(exposure, float(metrics.get("lead_time_days") or 0))

    return round(healthy / len(materials) * 100, 1), exposure


def _clamp(features: dict[str, float]) -> tuple[dict[str, float], list[str]]:
    clamped: dict[str, float] = {}
    touched: list[str] = []
    for name, value in features.items():
        low, high = TRAINING_RANGES.get(name, (float("-inf"), float("inf")))
        bounded = max(low, min(high, float(value)))
        if bounded != float(value):
            touched.append(name)
        clamped[name] = bounded
    return clamped, touched


def predict(
    project: dict,
    *,
    schedule: dict,
    budget: dict,
    tasks: list[dict],
    materials: list[dict],
    site_updates: list[dict],
) -> dict | None:
    """The model's delay probability for one project, or None if it cannot run."""
    bundle = _bundle()
    if bundle is None:
        return None

    raw = build_features(
        project, schedule=schedule, budget=budget,
        tasks=tasks, materials=materials, site_updates=site_updates,
    )
    features, touched = _clamp(raw)

    order = list(bundle["feature_names"])
    try:
        import pandas as pd

        row = pd.DataFrame([[features[name] for name in order]], columns=order)
        probability = float(bundle["model"].predict_proba(row)[0][1])
    except Exception as exc:
        log.warning("Delay prediction failed for project %s: %s", project.get("id"), exc)
        return None

    threshold = float(bundle.get("threshold") or 0.5)
    return {
        "delay_probability": round(probability * 100, 1),
        "risk_band": band(probability),
        "flagged": probability >= threshold,
        "threshold": round(threshold, 3),
        "model": bundle.get("model_name"),
        "features": {name: round(features[name], 2) for name in order},
        "clamped_features": touched,
        "drivers": _drivers(bundle, features),
    }


def band(probability: float) -> str:
    if probability >= BAND_HIGH:
        return "high"
    if probability >= BAND_MEDIUM:
        return "medium"
    return "low"


def _drivers(bundle: dict, features: dict[str, float], limit: int = 3) -> list[dict]:
    """The features pushing this project's score, by trained importance.

    The model is one linear stage behind a scaler, so the SHAP importances
    saved at training time rank which inputs move a score at all; combining
    that ranking with this project's values says what to look at first.
    """
    importance = bundle.get("shap_importance") or {}
    direction = bundle.get("feature_direction") or {}
    ranked = sorted(
        (name for name in features if name in importance),
        key=lambda name: -abs(float(importance[name])),
    )
    return [
        {
            "feature": name,
            "value": round(features[name], 2),
            "direction": direction.get(name),
            "importance": round(float(importance[name]), 4),
        }
        for name in ranked[:limit]
    ]
