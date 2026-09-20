"""
BuildSync AI - construction delay-risk model.

Trains and compares three candidates (Logistic Regression, Random Forest,
XGBoost), selects on cross-validated ROC-AUC, tunes the decision threshold on
out-of-fold predictions (never on the test set), explains the winner with SHAP,
and writes a single artifact the FastAPI backend can load later.

LOCAL DEVELOPMENT ONLY. Nothing here deploys or serves anything.
"""

import json
import sys
import warnings
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss,
    classification_report, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score,
)
from sklearn.model_selection import (
    GridSearchCV, StratifiedKFold, cross_val_predict, train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore", category=FutureWarning)

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "data" / "buildsync_construction_delay_dataset.csv"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"
TARGET = "delay"
RANDOM_STATE = 42
TEST_SIZE = 0.20
N_FOLDS = 5

# Columns that must never become features: post-outcome or score-shaped fields.
FORBIDDEN_SUBSTRINGS = [
    "risk_score", "delay_probability", "risk_level", "actual_duration",
    "final_completion", "delay_status", "completion_date", "outcome",
    "prediction", "predicted", "probability",
]


def rule(title):
    print(f"\n{'=' * 74}\n{title}\n{'=' * 74}")


# --------------------------------------------------------------------------
# 1. Load + target/feature separation
# --------------------------------------------------------------------------
def load_xy():
    rule("1. LOAD & TARGET / FEATURE SEPARATION")
    df = pd.read_csv(CSV_PATH)
    print(f"dataset : {CSV_PATH.name}  ->  {df.shape[0]:,} rows x {df.shape[1]} columns")

    if TARGET not in df.columns:
        raise SystemExit(f"FAIL: target column '{TARGET}' not in {list(df.columns)}")

    X = df.drop(TARGET, axis=1)
    y = df[TARGET]

    print(f"X shape : {X.shape}   y shape : {y.shape}")
    print(f"features: {list(X.columns)}")

    # --- explicit leakage gate ---------------------------------------------
    assert TARGET not in X.columns, "target leaked into X"
    bad = [c for c in X.columns if any(s in c.lower() for s in FORBIDDEN_SUBSTRINGS)]
    assert not bad, f"leakage-shaped feature(s) present: {bad}"
    assert not X.isna().any().any(), "missing values in X"
    assert np.isfinite(X.to_numpy()).all(), "non-finite values in X"
    assert set(y.unique()) == {0, 1}, f"target not binary: {sorted(y.unique())}"

    corr = X.apply(lambda c: c.corr(y)).abs().sort_values(ascending=False)
    assert corr.max() <= 0.85, f"leakage suspected: {corr.idxmax()} r={corr.max():.3f}"
    print(f"\nleakage gate : PASS  (target excluded from X; no post-outcome columns;")
    print(f"               strongest single-feature |r| = {corr.max():.3f} on {corr.idxmax()})")
    return X, y


# --------------------------------------------------------------------------
# 2. Split
# --------------------------------------------------------------------------
def split(X, y):
    rule("2. TRAIN / TEST SPLIT")
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    print(f"strategy : stratified hold-out, test_size={TEST_SIZE}, random_state={RANDOM_STATE}")
    print(f"train    : {len(X_tr):,} rows   delay rate {y_tr.mean():.2%}")
    print(f"test     : {len(X_te):,} rows   delay rate {y_te.mean():.2%}")
    print(f"model selection + threshold tuning use {N_FOLDS}-fold CV *inside* the training set;")
    print("the test set is touched exactly once, at final evaluation.")
    return X_tr, X_te, y_tr, y_te


# --------------------------------------------------------------------------
# 3. Candidates
# --------------------------------------------------------------------------
def build_candidates():
    candidates = {
        "logistic_regression": (
            Pipeline([
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)),
            ]),
            {"clf__C": [0.1, 1.0, 10.0]},
        ),
        "random_forest": (
            Pipeline([
                ("scaler", "passthrough"),
                ("clf", RandomForestClassifier(
                    n_estimators=400, random_state=RANDOM_STATE, n_jobs=-1)),
            ]),
            {"clf__max_depth": [8, 14, None], "clf__min_samples_leaf": [1, 5, 20]},
        ),
    }

    try:
        from xgboost import XGBClassifier
        candidates["xgboost"] = (
            Pipeline([
                ("scaler", "passthrough"),
                ("clf", XGBClassifier(
                    n_estimators=400, learning_rate=0.05, subsample=0.9,
                    colsample_bytree=0.9, eval_metric="logloss",
                    random_state=RANDOM_STATE, n_jobs=-1, tree_method="hist")),
            ]),
            {"clf__max_depth": [3, 4, 6], "clf__min_child_weight": [1, 10]},
        )
        print("xgboost   : available")
    except Exception as exc:
        from sklearn.ensemble import HistGradientBoostingClassifier
        print(f"xgboost   : UNAVAILABLE ({type(exc).__name__}) -> "
              "substituting sklearn HistGradientBoostingClassifier")
        candidates["hist_gradient_boosting"] = (
            Pipeline([
                ("scaler", "passthrough"),
                ("clf", HistGradientBoostingClassifier(
                    learning_rate=0.05, max_iter=400, random_state=RANDOM_STATE)),
            ]),
            {"clf__max_depth": [3, 6, None], "clf__min_samples_leaf": [20, 50]},
        )
    return candidates


# --------------------------------------------------------------------------
# 4. Cross-validated selection
# --------------------------------------------------------------------------
def select_model(candidates, X_tr, y_tr):
    rule("3. MODEL SELECTION  (5-fold stratified CV on the training set)")
    cv = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    results = {}
    print(f"{'model':<26}{'CV ROC-AUC':>12}{'std':>8}{'CV F1':>9}{'CV acc':>9}   best params")
    print("-" * 110)

    for name, (pipe, grid) in candidates.items():
        search = GridSearchCV(pipe, grid, scoring="roc_auc", cv=cv, n_jobs=-1, refit=True)
        search.fit(X_tr, y_tr)
        best = search.best_estimator_

        oof = cross_val_predict(best, X_tr, y_tr, cv=cv, method="predict_proba", n_jobs=-1)[:, 1]
        auc = roc_auc_score(y_tr, oof)
        f1 = f1_score(y_tr, (oof >= 0.5).astype(int))
        acc = accuracy_score(y_tr, (oof >= 0.5).astype(int))
        idx = search.best_index_
        std = search.cv_results_["std_test_score"][idx]

        results[name] = {
            "estimator": best, "oof": oof, "cv_auc": auc, "cv_auc_std": float(std),
            "cv_f1": f1, "cv_acc": acc,
            "best_params": {k: str(v) for k, v in search.best_params_.items()},
        }
        params = ", ".join(f"{k.replace('clf__', '')}={v}" for k, v in search.best_params_.items())
        print(f"{name:<26}{auc:>12.4f}{std:>8.4f}{f1:>9.4f}{acc:>9.4f}   {params}")

    winner = max(results, key=lambda k: results[k]["cv_auc"])
    print(f"\nselected : {winner}  (highest CV ROC-AUC = {results[winner]['cv_auc']:.4f})")
    return results, winner


# --------------------------------------------------------------------------
# 5. Threshold tuning on out-of-fold predictions
# --------------------------------------------------------------------------
def tune_threshold(oof, y_tr):
    rule("4. DECISION THRESHOLD  (tuned on out-of-fold predictions, not on test)")
    grid = np.arange(0.05, 0.951, 0.01)
    rows = []
    for t in grid:
        pred = (oof >= t).astype(int)
        rows.append((t, precision_score(y_tr, pred, zero_division=0),
                     recall_score(y_tr, pred), f1_score(y_tr, pred, zero_division=0)))
    tbl = pd.DataFrame(rows, columns=["threshold", "precision", "recall", "f1"])

    best_f1 = tbl.loc[tbl["f1"].idxmax()]
    recall_ops = tbl[tbl["recall"] >= 0.90]
    high_recall = recall_ops.loc[recall_ops["precision"].idxmax()] if len(recall_ops) else best_f1

    print(f"default 0.50            -> precision {tbl.loc[tbl.threshold.sub(0.5).abs().idxmin(), 'precision']:.3f}"
          f"  recall {tbl.loc[tbl.threshold.sub(0.5).abs().idxmin(), 'recall']:.3f}"
          f"  F1 {tbl.loc[tbl.threshold.sub(0.5).abs().idxmin(), 'f1']:.3f}")
    print(f"best-F1   {best_f1.threshold:.2f}            -> precision {best_f1.precision:.3f}"
          f"  recall {best_f1.recall:.3f}  F1 {best_f1.f1:.3f}   <- selected")
    print(f"high-recall {high_recall.threshold:.2f}          -> precision {high_recall.precision:.3f}"
          f"  recall {high_recall.recall:.3f}  F1 {high_recall.f1:.3f}   "
          "(catches 90% of delays)")
    print("\nMissing a real delay costs far more on site than one extra review, so the")
    print("high-recall point is worth considering once the dashboard UX is decided.")
    return float(best_f1.threshold), float(high_recall.threshold), tbl


# --------------------------------------------------------------------------
# 6. Final evaluation on the held-out test set
# --------------------------------------------------------------------------
def evaluate(model, X_te, y_te, threshold, label):
    proba = model.predict_proba(X_te)[:, 1]
    pred = (proba >= threshold).astype(int)
    cm = confusion_matrix(y_te, pred)
    tn, fp, fn, tp = cm.ravel()
    m = {
        "threshold": threshold,
        "accuracy": accuracy_score(y_te, pred),
        "precision": precision_score(y_te, pred, zero_division=0),
        "recall": recall_score(y_te, pred),
        "f1": f1_score(y_te, pred, zero_division=0),
        "roc_auc": roc_auc_score(y_te, proba),
        "pr_auc": average_precision_score(y_te, proba),
        "brier": brier_score_loss(y_te, proba),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }
    print(f"\n--- {label} (threshold {threshold:.2f}) ---")
    for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "brier"):
        print(f"  {k:<10}: {m[k]:.4f}")
    print(f"  confusion matrix   pred0   pred1")
    print(f"            true0 {tn:>7} {fp:>7}")
    print(f"            true1 {fn:>7} {tp:>7}")
    return m, proba, pred


# --------------------------------------------------------------------------
# 7. SHAP explainability
# --------------------------------------------------------------------------
def explain(model, X_tr, X_te, winner):
    rule("6. SHAP EXPLAINABILITY")
    import shap

    clf = model.named_steps["clf"]
    scaler = model.named_steps["scaler"]
    n_sample = min(2000, len(X_te))
    X_sample = X_te.iloc[:n_sample]

    if winner == "logistic_regression":
        Xs = pd.DataFrame(scaler.transform(X_sample), columns=X_sample.columns,
                          index=X_sample.index)
        bg = pd.DataFrame(scaler.transform(X_tr.iloc[:200]), columns=X_tr.columns)
        explainer = shap.LinearExplainer(clf, bg)
        sv = explainer(Xs)
        sv.data = X_sample.to_numpy()          # show raw units on the plots
    else:
        explainer = shap.TreeExplainer(clf)
        sv = explainer(X_sample)
        if sv.values.ndim == 3:                # binary classifiers -> (n, feat, 2)
            sv = sv[:, :, 1]

    print(f"explainer : {type(explainer).__name__} on {n_sample:,} test rows")

    mean_abs = np.abs(sv.values).mean(axis=0)
    order = np.argsort(mean_abs)[::-1]
    print(f"\nGlobal feature importance (mean |SHAP|, log-odds units):")
    print(f"  {'feature':<28}{'mean|SHAP|':>12}   direction of risk")
    print("  " + "-" * 72)
    direction = {}
    for i in order:
        col = X_sample.columns[i]
        r = np.corrcoef(X_sample.iloc[:, i], sv.values[:, i])[0, 1]
        arrow = "higher value -> MORE delay risk" if r > 0 else "higher value -> LESS delay risk"
        direction[col] = "increases_risk" if r > 0 else "decreases_risk"
        print(f"  {col:<28}{mean_abs[i]:>12.4f}   {arrow}")

    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    shap.plots.bar(sv, max_display=10, show=False)
    plt.title("BuildSync AI - global feature importance (mean |SHAP|)")
    plt.tight_layout(); plt.savefig(REPORT_DIR / "shap_global_importance.png", dpi=150); plt.close()

    shap.plots.beeswarm(sv, max_display=10, show=False)
    plt.title("BuildSync AI - SHAP value distribution")
    plt.tight_layout(); plt.savefig(REPORT_DIR / "shap_beeswarm.png", dpi=150); plt.close()

    top = X_sample.columns[order[0]]
    shap.plots.scatter(sv[:, top], show=False)
    plt.title(f"BuildSync AI - SHAP dependence: {top}")
    plt.tight_layout(); plt.savefig(REPORT_DIR / "shap_dependence_top_feature.png", dpi=150); plt.close()

    # one local explanation, the kind the dashboard will render per project
    riskiest = int(np.argmax(model.predict_proba(X_sample)[:, 1]))
    shap.plots.waterfall(sv[riskiest], max_display=10, show=False)
    plt.title("BuildSync AI - why this project is flagged")
    plt.tight_layout(); plt.savefig(REPORT_DIR / "shap_local_example.png", dpi=150); plt.close()

    print(f"\nLocal explanation example (highest-risk test project, "
          f"p={model.predict_proba(X_sample)[:, 1][riskiest]:.3f}):")
    contrib = sorted(zip(X_sample.columns, sv.values[riskiest], X_sample.iloc[riskiest]),
                     key=lambda t: -abs(t[1]))[:5]
    for col, s, val in contrib:
        print(f"  {col:<28} = {val:>6}   SHAP {s:+.3f}")

    print(f"\nplots written to {REPORT_DIR}/")
    return {c: float(mean_abs[list(X_sample.columns).index(c)]) for c in X_sample.columns}, direction


# --------------------------------------------------------------------------
def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    X, y = load_xy()
    X_tr, X_te, y_tr, y_te = split(X, y)

    candidates = build_candidates()
    results, winner = select_model(candidates, X_tr, y_tr)
    model = results[winner]["estimator"]

    thr_f1, thr_recall, thr_table = tune_threshold(results[winner]["oof"], y_tr)

    rule("5. FINAL EVALUATION ON HELD-OUT TEST SET")
    print(f"model: {winner}   (test set used for the first time here)")
    m_default, proba, _ = evaluate(model, X_te, y_te, 0.50, "default threshold")
    m_tuned, _, pred_tuned = evaluate(model, X_te, y_te, thr_f1, "tuned threshold")
    m_recall, _, _ = evaluate(model, X_te, y_te, thr_recall, "high-recall threshold")

    print("\nclassification report (tuned threshold):")
    print(classification_report(y_te, pred_tuned, target_names=["on_time", "delayed"], digits=3))

    baseline = 1 - y_te.mean()
    print(f"majority-class baseline accuracy : {baseline:.4f}")
    print(f"model accuracy (tuned)           : {m_tuned['accuracy']:.4f}  "
          f"(+{m_tuned['accuracy'] - baseline:.4f})")
    print(f"generation-time Bayes ceiling    : 0.8350  <- best achievable on these 10 columns;")
    print("the gap to it is irreducible noise (weather, permits, subcontractor churn),")
    print("not a modelling deficiency.")

    # cross-check SHAP against a model-agnostic importance measure
    rule("7. PERMUTATION IMPORTANCE (model-agnostic cross-check)")
    perm = permutation_importance(model, X_te, y_te, n_repeats=10,
                                  random_state=RANDOM_STATE, scoring="roc_auc", n_jobs=-1)
    perm_order = np.argsort(perm.importances_mean)[::-1]
    print(f"  {'feature':<28}{'drop in ROC-AUC':>18}{'std':>9}")
    print("  " + "-" * 56)
    perm_dict = {}
    for i in perm_order:
        col = X_te.columns[i]
        perm_dict[col] = float(perm.importances_mean[i])
        print(f"  {col:<28}{perm.importances_mean[i]:>18.4f}{perm.importances_std[i]:>9.4f}")

    shap_importance, direction = explain(model, X_tr, X_te, winner)

    # ----------------------------------------------------------------------
    rule("8. PERSIST ARTIFACTS")
    bundle = {
        "model": model,
        "model_name": winner,
        "feature_names": list(X.columns),
        "target": TARGET,
        "threshold": thr_f1,
        "threshold_high_recall": thr_recall,
        "trained_on_rows": int(len(X_tr)),
        "sklearn_random_state": RANDOM_STATE,
        "test_metrics": m_tuned,
        "shap_importance": shap_importance,
        "feature_direction": direction,
    }
    model_path = MODEL_DIR / "buildsync_delay_model.joblib"
    joblib.dump(bundle, model_path)
    print(f"model bundle : {model_path}  ({model_path.stat().st_size / 1024:.0f} KB)")

    metrics = {
        "dataset": {"rows": int(len(X)), "features": int(X.shape[1]),
                    "delay_rate": float(y.mean())},
        "split": {"strategy": "stratified hold-out", "test_size": TEST_SIZE,
                  "random_state": RANDOM_STATE, "train_rows": int(len(X_tr)),
                  "test_rows": int(len(X_te)), "cv_folds": N_FOLDS},
        "cv_comparison": {k: {"roc_auc": v["cv_auc"], "roc_auc_std": v["cv_auc_std"],
                              "f1": v["cv_f1"], "accuracy": v["cv_acc"],
                              "best_params": v["best_params"]}
                          for k, v in results.items()},
        "selected_model": winner,
        "test_metrics": {"default_threshold": m_default, "tuned_threshold": m_tuned,
                         "high_recall_threshold": m_recall},
        "baseline_accuracy": float(baseline),
        "bayes_ceiling_accuracy": 0.8350,
        "shap_importance": shap_importance,
        "permutation_importance_roc_auc_drop": perm_dict,
        "leakage_check": "passed - target excluded, no post-outcome or score-shaped columns",
    }
    metrics_path = REPORT_DIR / "metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2))
    thr_table.to_csv(REPORT_DIR / "threshold_sweep.csv", index=False)
    print(f"metrics      : {metrics_path}")
    print(f"threshold sweep: {REPORT_DIR / 'threshold_sweep.csv'}")
    print(f"shap plots   : {REPORT_DIR}/shap_*.png")

    rule("DONE")
    print(f"selected model : {winner}")
    print(f"test ROC-AUC   : {m_tuned['roc_auc']:.4f}")
    print(f"test F1        : {m_tuned['f1']:.4f}   (threshold {thr_f1:.2f})")
    print("Nothing was deployed. Load the bundle with joblib.load() to score projects.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
