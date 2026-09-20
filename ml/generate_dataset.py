"""
BuildSync AI - synthetic dataset generator for construction delay-risk modelling.

Produces a compact, fully numeric, 11-column table:
    10 input features + 1 binary target (`delay`).

Design notes
------------
The rows are NOT sampled independently per column. A single latent "project
health" factor `h` drives progress, materials, labour, prior delays and budget
together, which is what produces the correlation structure a real portfolio
shows. The target is then a noisy logistic function of the OBSERVABLE columns
plus an unobserved shock (weather / permits / subcontractor churn), so the
classes overlap and the model has something real to learn.

Sampling frame: projects whose contractual deadline falls inside the app's
180-day risk-review horizon (that is when BuildSync scores a project), which is
why `deadline_days_remaining` is capped at 180. A few percent of long projects
sit at that cap.
"""

from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20260920
N_ROWS = 10_000
TARGET_DELAY_RATE = 0.30
OUT_PATH = Path(__file__).resolve().parent / "data" / "buildsync_construction_delay_dataset.csv"

FEATURES = [
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
]

# Hard ranges from the spec. Enforced with assertions before writing.
RANGES = {
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


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def build_frame(n, rng):
    # --- latent project health (never written to the CSV) -------------------
    h = rng.normal(0.0, 1.0, n)

    # --- 1. planned duration ------------------------------------------------
    planned = np.clip(np.round(rng.lognormal(np.log(110), 0.55, n)), 30, 365)

    # --- 2. elapsed days ----------------------------------------------------
    # Stage of life is sampled independently of project size, so the portfolio
    # holds long projects at every stage rather than only late ones. Tying the
    # window to `planned` instead pushed VIF(planned_duration_days) past 70.
    frac = 0.05 + 0.92 * rng.beta(2.0, 1.7, n)   # mid-to-late stage skew
    elapsed = np.clip(np.round(planned * frac), 5, planned - 2)
    elapsed_frac = elapsed / planned

    # --- 4. material availability ------------------------------------------
    shortfall = rng.gamma(1.6, 5.5, n) * np.exp(-0.45 * h)
    material_availability = np.clip(np.round(100 - shortfall), 40, 100)

    # --- 5. material delay --------------------------------------------------
    lam_mat = np.exp(-0.20 - 0.50 * h + 0.045 * shortfall)
    material_delay = np.clip(rng.poisson(lam_mat), 0, 20)

    # --- 6. labour ----------------------------------------------------------
    # Expected crew scales with project size; adequacy varies around it.
    crew_base = 8.0 + 0.16 * planned
    adequacy = rng.lognormal(0.0, 0.32, n) * np.exp(0.12 * h)
    labor = np.clip(np.round(crew_base * adequacy), 5, 100)
    log_adequacy = np.log(labor / crew_base)     # latent, used for the target only

    # --- 7. previous delays -------------------------------------------------
    lam_prev = np.exp(0.55 - 0.75 * h + 0.50 * elapsed_frac)
    previous_delays = np.clip(rng.poisson(lam_prev), 0, 8)

    # --- 3. progress variance ----------------------------------------------
    progress_variance = np.clip(
        np.round(
            -4.0
            + 8.5 * h
            - 0.22 * material_delay
            - 0.06 * shortfall
            + 6.0 * log_adequacy
            + rng.normal(0.0, 4.5, n)
        ),
        -40,
        20,
    )

    # --- 8. budget variance -------------------------------------------------
    budget_variance = np.clip(
        np.round(
            4.0
            - 5.5 * h
            + 0.35 * material_delay
            + 0.60 * previous_delays
            - 0.25 * progress_variance
            + rng.normal(0.0, 5.0, n)
        ),
        -10,
        30,
    )

    # --- 9. deadline days remaining ----------------------------------------
    # Baseline is planned - elapsed, adjusted by re-baselining / variation
    # orders. The adjustment scales with project size (a 300-day job gets
    # renegotiated in weeks, a 40-day job in days), 10% of projects carry no
    # adjustment, and a delay history makes an extension more likely. A wider
    # adjustment is what keeps `deadline_days_remaining` from being an almost
    # exact restatement of planned - elapsed.
    delta = rng.normal(0.03 * planned, 0.14 * planned, n) + 1.6 * previous_delays
    delta = np.clip(delta, -0.25 * planned, 0.50 * planned)
    delta = np.where(rng.random(n) < 0.10, 0.0, delta)
    deadline_remaining = np.clip(np.round((planned - elapsed) + delta), 1, 180)

    # --- 10. task completion rate ------------------------------------------
    # Count-based task closure: tracks physical progress but is not identical
    # to it, so it is correlated with progress_variance without being derivable.
    planned_progress = 100.0 * elapsed_frac
    task_completion = np.clip(
        np.round(planned_progress + progress_variance + rng.normal(0.0, 7.5, n)), 0, 100
    )

    df = pd.DataFrame(
        {
            "planned_duration_days": planned,
            "elapsed_days": elapsed,
            "progress_variance_pct": progress_variance,
            "material_availability_pct": material_availability,
            "material_delay_days": material_delay,
            "labor_count": labor,
            "previous_delay_count": previous_delays,
            "budget_variance_pct": budget_variance,
            "deadline_days_remaining": deadline_remaining,
            "task_completion_rate_pct": task_completion,
        }
    ).astype("int64")

    return df, log_adequacy


def observable_score(df, log_adequacy):
    """Latent log-odds built ONLY from columns the model will see."""
    work_left = 100.0 - df["task_completion_rate_pct"].to_numpy()
    required_rate = np.clip(work_left / df["deadline_days_remaining"].to_numpy(), 0.0, 6.0)

    return (
        -0.085 * df["progress_variance_pct"].to_numpy()
        - 0.030 * (df["material_availability_pct"].to_numpy() - 90.0)
        + 0.075 * df["material_delay_days"].to_numpy()
        + 0.260 * df["previous_delay_count"].to_numpy()
        + 0.045 * df["budget_variance_pct"].to_numpy()
        - 0.012 * df["deadline_days_remaining"].to_numpy()
        - 0.022 * df["task_completion_rate_pct"].to_numpy()
        - 0.550 * log_adequacy
        + 0.350 * required_rate
    )


def calibrate_intercept(score, shock_sd, target_rate):
    """Bisect the intercept so the marginal delay rate hits the target."""
    nodes, weights = np.polynomial.hermite_e.hermegauss(31)
    weights = weights / weights.sum()
    shock = nodes * shock_sd

    def marginal_rate(b0):
        p = sigmoid(score[:, None] + b0 + shock[None, :]) @ weights
        return p.mean(), p

    lo, hi = -12.0, 12.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        rate, _ = marginal_rate(mid)
        if rate < target_rate:
            lo = mid
        else:
            hi = mid
    b0 = 0.5 * (lo + hi)
    rate, p_obs = marginal_rate(b0)
    return b0, p_obs, rate


def main():
    rng = np.random.default_rng(SEED)

    df, log_adequacy = build_frame(N_ROWS, rng)

    # Target: logistic in the observable features + an unobserved shock that
    # stands in for weather, permits and subcontractor availability. The shock
    # is what keeps the classes from being separable.
    shock_sd = 0.9
    score = observable_score(df, log_adequacy)
    b0, p_obs, marginal = calibrate_intercept(score, shock_sd, TARGET_DELAY_RATE)

    shock = rng.normal(0.0, shock_sd, len(df))
    p_row = sigmoid(score + b0 + shock)
    y = (rng.random(len(df)) < p_row).astype("int64")
    df["delay"] = y

    # --- de-duplicate: resample any exact duplicate row ---------------------
    attempts = 0
    while df.duplicated().any() and attempts < 25:
        dup_idx = df.index[df.duplicated()]
        repl, repl_adeq = build_frame(len(dup_idx), rng)
        repl_score = observable_score(repl, repl_adeq)
        repl_p = sigmoid(repl_score + b0 + rng.normal(0.0, shock_sd, len(repl)))
        repl["delay"] = (rng.random(len(repl)) < repl_p).astype("int64")
        df.loc[dup_idx, :] = repl.set_index(dup_idx)
        attempts += 1

    # --- assertions ---------------------------------------------------------
    assert list(df.columns) == FEATURES + ["delay"], df.columns.tolist()
    assert len(df) == N_ROWS
    assert df.isna().sum().sum() == 0
    assert not df.duplicated().any(), f"{df.duplicated().sum()} duplicate rows remain"
    assert set(df["delay"].unique()) == {0, 1}
    for col, (mn, mx) in RANGES.items():
        assert df[col].min() >= mn, (col, df[col].min(), mn)
        assert df[col].max() <= mx, (col, df[col].max(), mx)
    # No impossible combinations.
    assert (df["elapsed_days"] < df["planned_duration_days"]).all()
    assert (df["deadline_days_remaining"] >= 1).all()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    # --- generation diagnostics --------------------------------------------
    bayes_acc = np.maximum(p_obs, 1 - p_obs).mean()
    borderline = ((p_obs > 0.30) & (p_obs < 0.70)).mean()
    print(f"written            : {OUT_PATH}")
    print(f"rows x cols        : {df.shape[0]} x {df.shape[1]}")
    print(f"calibrated b0      : {b0:.4f}  (marginal p = {marginal:.4f})")
    print(f"empirical delay rate: {df['delay'].mean():.4f}")
    print(f"Bayes-optimal acc   : {bayes_acc:.4f}   <- ceiling for any model on these 10 cols")
    print(f"borderline rows     : {borderline:.1%}  (0.30 < p < 0.70)")
    print(f"p_obs percentiles   : " + ", ".join(
        f"p{q}={np.percentile(p_obs, q):.3f}" for q in (1, 25, 50, 75, 99)))


if __name__ == "__main__":
    main()
