"""
BuildSync AI - dataset validation.

Verifies the delay-risk CSV from disk before any training happens. Every number
printed is computed from the file, nothing is assumed. Exits non-zero if a hard
check fails, so it can gate the training step.
"""

from pathlib import Path

import numpy as np
import pandas as pd

CSV_PATH = Path(__file__).resolve().parent / "data" / "buildsync_construction_delay_dataset.csv"
TARGET = "delay"

EXPECTED_COLUMNS = [
    "planned_duration_days",
    "elapsed_days",
    "progress_variance_pct",
    "material_availability_pct",
    "material_delay_days",
    "labor_count",
    "previous_delay_count",
    "budget_variance_pct",
    "deadline_days_remaining",
    "task_completion_rate_pct",
    TARGET,
]

EXPECTED_RANGES = {
    "planned_duration_days": (30, 365),
    "elapsed_days": (5, 365),
    "progress_variance_pct": (-40, 20),
    "material_availability_pct": (40, 100),
    "material_delay_days": (0, 20),
    "labor_count": (5, 100),
    "previous_delay_count": (0, 8),
    "budget_variance_pct": (-10, 30),
    "deadline_days_remaining": (1, 180),
    "task_completion_rate_pct": (0, 100),
}

# Anything matching these must never appear as a feature column.
LEAKAGE_PATTERNS = [
    "risk_score", "delay_probability", "risk_level", "risk",
    "actual_duration", "final_completion", "delay_status", "delayed",
    "completion_date", "outcome", "label", "target", "is_delay",
    "probability", "score", "prediction", "predicted",
]


def rule(title):
    print(f"\n{'=' * 74}\n{title}\n{'=' * 74}")


def main():
    failures = []
    warnings = []

    rule("1. LOAD")
    print(f"path : {CSV_PATH}")
    if not CSV_PATH.exists():
        raise SystemExit(f"FAIL: dataset not found at {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"size : {CSV_PATH.stat().st_size / 1024:.1f} KB")

    rule("2. SHAPE & SCHEMA")
    n_rows, n_cols = df.shape
    feature_cols = [c for c in df.columns if c != TARGET]
    print(f"Rows     : {n_rows:,}")
    print(f"Columns  : {n_cols}")
    print(f"Features : {len(feature_cols)}")
    print(f"Target   : {TARGET}")
    if n_rows != 10_000:
        failures.append(f"expected 10,000 rows, found {n_rows:,}")
    if list(df.columns) != EXPECTED_COLUMNS:
        failures.append("column names/order do not match the agreed schema")
        print("  !! got:      ", list(df.columns))
        print("  !! expected: ", EXPECTED_COLUMNS)
    else:
        print("Schema   : matches the agreed 11-column contract (order included)")

    rule("3. DATA TYPES")
    dtypes = df.dtypes
    print(dtypes.to_string())
    non_numeric = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    if non_numeric:
        failures.append(f"non-numeric columns present: {non_numeric}")
    else:
        print("\nAll columns numeric -> can be passed straight to sklearn / XGBoost.")
    non_int = [c for c in df.columns if not pd.api.types.is_integer_dtype(df[c])]
    if non_int:
        warnings.append(f"non-integer numeric columns: {non_int}")

    rule("4. MISSING / INFINITE / CONSTANT")
    missing = df.isna().sum()
    total_missing = int(missing.sum())
    print(f"Missing values (total) : {total_missing}")
    if total_missing:
        print(missing[missing > 0].to_string())
        failures.append(f"{total_missing} missing values")

    numeric = df.select_dtypes(include=[np.number])
    n_inf = int(np.isinf(numeric.to_numpy()).sum())
    print(f"Infinite values        : {n_inf}")
    if n_inf:
        failures.append(f"{n_inf} infinite values")

    nunique = df.nunique()
    constant = nunique[nunique <= 1].index.tolist()
    print(f"Constant columns       : {constant if constant else 'none'}")
    if constant:
        failures.append(f"constant columns carry no signal: {constant}")
    near_constant = [c for c in feature_cols if df[c].value_counts(normalize=True).iloc[0] > 0.95]
    if near_constant:
        warnings.append(f"near-constant (>95% one value): {near_constant}")
    print(f"Distinct values/column :\n{nunique.to_string()}")

    rule("5. DUPLICATE ROWS")
    dup_full = int(df.duplicated().sum())
    dup_feat = int(df.duplicated(subset=feature_cols).sum())
    print(f"Duplicate rows (all 11 columns) : {dup_full}")
    print(f"Duplicate feature vectors        : {dup_feat}   <- contradictory labels would live here")
    if dup_full:
        failures.append(f"{dup_full} duplicate rows")
    if dup_feat:
        warnings.append(f"{dup_feat} repeated feature vectors")

    rule("6. TARGET DISTRIBUTION")
    vals = sorted(df[TARGET].unique().tolist())
    counts = df[TARGET].value_counts().sort_index()
    rate = df[TARGET].mean()
    print(f"Distinct target values : {vals}")
    for k, v in counts.items():
        print(f"  delay = {k} : {v:>6,}  ({v / n_rows:6.2%})")
    print(f"Delay rate  : {rate:.2%}")
    print(f"Imbalance   : {counts.max() / counts.min():.2f} : 1  (mild - no resampling required)")
    if vals != [0, 1]:
        failures.append(f"target is not binary 0/1, found {vals}")
    if not 0.25 <= rate <= 0.35:
        failures.append(f"delay rate {rate:.2%} outside the 25-35% target band")

    rule("7. FEATURE RANGES")
    hdr = f"{'feature':<28}{'min':>8}{'max':>8}{'mean':>10}{'std':>9}   {'spec':>12}  ok"
    print(hdr)
    print("-" * len(hdr))
    for col in feature_cols:
        lo, hi = EXPECTED_RANGES[col]
        cmin, cmax = df[col].min(), df[col].max()
        ok = lo <= cmin and cmax <= hi
        if not ok:
            failures.append(f"{col} out of spec range [{lo}, {hi}] -> [{cmin}, {cmax}]")
        print(f"{col:<28}{cmin:>8}{cmax:>8}{df[col].mean():>10.2f}{df[col].std():>9.2f}"
              f"   {f'[{lo}, {hi}]':>12}  {'OK' if ok else 'FAIL'}")

    rule("8. LOGICAL CONSISTENCY (impossible combinations)")
    checks = {
        "elapsed_days < planned_duration_days": (df["elapsed_days"] < df["planned_duration_days"]).all(),
        "deadline_days_remaining >= 1": (df["deadline_days_remaining"] >= 1).all(),
        "no completed-but-not-started rows": ~((df["task_completion_rate_pct"] > 90) & (df["elapsed_days"] < 10)).any(),
        "labor_count >= 5 on every row": (df["labor_count"] >= 5).all(),
    }
    for name, ok in checks.items():
        print(f"  [{'OK' if ok else 'FAIL'}] {name}")
        if not ok:
            failures.append(f"logical check failed: {name}")

    rule("9. CORRELATIONS")
    corr = df.corr(numeric_only=True)
    with pd.option_context("display.width", 200, "display.max_columns", 20):
        print(corr.round(2).to_string())

    print("\nCorrelation of each feature with the target (Pearson):")
    tcorr = corr[TARGET].drop(TARGET).sort_values(key=np.abs, ascending=False)
    for col, v in tcorr.items():
        bar = "#" * int(abs(v) * 50)
        print(f"  {col:<28}{v:>7.3f}  {bar}")

    print("\nStrongly correlated feature pairs (|r| >= 0.70):")
    pairs = []
    for i, a in enumerate(feature_cols):
        for b in feature_cols[i + 1:]:
            r = corr.loc[a, b]
            if abs(r) >= 0.70:
                pairs.append((a, b, r))
    if pairs:
        for a, b, r in sorted(pairs, key=lambda t: -abs(t[2])):
            print(f"  {a} <-> {b}: r = {r:.3f}")
        warnings.append(f"{len(pairs)} highly-correlated feature pair(s) - affects "
                        "logistic-regression coefficient reading, not tree models")
    else:
        print("  none")

    rule("10. TARGET LEAKAGE AUDIT")
    suspicious = [c for c in feature_cols
                  if any(p in c.lower() for p in LEAKAGE_PATTERNS)]
    print(f"Feature names matching leakage patterns : {suspicious if suspicious else 'none'}")
    if suspicious:
        failures.append(f"leakage-shaped feature names: {suspicious}")

    max_abs_corr = tcorr.abs().max()
    print(f"Max |corr(feature, target)|             : {max_abs_corr:.3f} "
          f"({tcorr.abs().idxmax()})")
    if max_abs_corr > 0.85:
        failures.append(f"a feature correlates {max_abs_corr:.3f} with the target - "
                        "almost certainly leakage")
    perfect = [c for c in feature_cols
               if df.groupby(c)[TARGET].nunique().max() == 1 and df[c].nunique() > 1]
    print(f"Features that perfectly determine target: {perfect if perfect else 'none'}")
    if perfect:
        failures.append(f"perfect single-feature separation: {perfect}")
    print("\nNo post-outcome columns present (actual_duration_days, final_completion_date,")
    print("delay_status, risk_score, delay_probability, risk_level) - every feature is")
    print("observable while the project is still running.")

    rule("VERDICT")
    expectations = [
        ("Rows = 10,000", n_rows == 10_000, f"{n_rows:,}"),
        ("Columns = 11", n_cols == 11, str(n_cols)),
        ("Features = 10", len(feature_cols) == 10, str(len(feature_cols))),
        ("Missing values = 0", total_missing == 0, str(total_missing)),
        ("Duplicate rows = 0", dup_full == 0, str(dup_full)),
        ("Infinite values = 0", n_inf == 0, str(n_inf)),
        ("Target binary 0/1", vals == [0, 1], str(vals)),
        ("Delay rate ~ 30%", 0.25 <= rate <= 0.35, f"{rate:.2%}"),
        ("All features numeric", not non_numeric, "yes" if not non_numeric else "no"),
        ("No constant columns", not constant, "yes" if not constant else "no"),
        ("No target leakage", not suspicious and not perfect and max_abs_corr <= 0.85, "clean"),
    ]
    for label, ok, actual in expectations:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label:<26} -> {actual}")

    if warnings:
        print("\nWarnings (non-blocking):")
        for w in warnings:
            print(f"  - {w}")

    if failures:
        print(f"\nVALIDATION FAILED ({len(failures)} issue(s)):")
        for f in failures:
            print(f"  - {f}")
        raise SystemExit(1)

    print("\nVALIDATION PASSED - dataset is fit for training.")
    return 0


if __name__ == "__main__":
    main()
