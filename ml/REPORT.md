# BuildSync AI — Construction Delay Risk: Dataset & Model Report

Local development only. Nothing in this directory deploys or serves anything.

```
ml/
├── generate_dataset.py                          # synthetic data generator
├── validate_dataset.py                          # pre-training validation gate
├── train_model.py                               # train / select / explain / persist
├── requirements.txt                             # training-time dependencies
├── data/buildsync_construction_delay_dataset.csv
├── models/buildsync_delay_model.joblib
└── reports/  metrics.json, threshold_sweep.csv, shap_*.png
```

Reproduce with:

```bash
backend/.venv/bin/python ml/generate_dataset.py
backend/.venv/bin/python ml/validate_dataset.py
backend/.venv/bin/python ml/train_model.py
```

---

## Part 1 — Dataset

### 1. Number of rows

**10,000.** No missing values, no duplicate rows, no duplicate feature vectors,
no infinite values, no constant columns. Every column is `int64`, so the file
goes straight into scikit-learn or XGBoost with no encoding step.

### 2. Number of features

**10 input features + 1 binary target = 11 columns.** No ID column, no text
column, no categorical column.

### 3. Target distribution

| `delay` | meaning | rows | share |
|---|---|---|---|
| 0 | on time / unlikely to be delayed | 6,965 | 69.65% |
| 1 | delayed / likely to be delayed | 3,035 | 30.35% |

Imbalance is 2.29 : 1 — mild enough that no resampling (SMOTE, class weights) is
needed. Threshold tuning handles it better, and keeps probabilities calibrated.

### 4 & 5. Feature descriptions and why each one is useful

| # | Feature | Range in file | What it measures | Why it predicts delay |
|---|---|---|---|---|
| 1 | `planned_duration_days` | 30–365 | Baseline duration of the project/task | Sets the scale everything else is judged against. Its effect is *conditional*: given a fixed crew, a longer job is riskier because the same crew is spread thinner. |
| 2 | `elapsed_days` | 5–358 | Days since start | Establishes how far into the job the snapshot is, so progress can be judged against expectation rather than in absolute terms. |
| 3 | `progress_variance_pct` | −40 … +20 | Actual minus planned physical progress | **Strongest single predictor.** Directly measures schedule slippage already incurred; slippage rarely recovers on its own. |
| 4 | `material_availability_pct` | 40–100 | Share of required materials on site | Work physically cannot proceed past a material shortfall, however good the crew. |
| 5 | `material_delay_days` | 0–20 | Days materials have been late | Converts a supply problem into schedule units. Leading indicator — it bites before progress variance shows it. |
| 6 | `labor_count` | 5–100 | Workers currently assigned | Only meaningful against project size; the model learns adequacy from `labor_count` together with `planned_duration_days`. |
| 7 | `previous_delay_count` | 0–8 | Prior delays on this project/task | Delay is autocorrelated. Past slippage captures chronic site/subcontractor problems no single snapshot shows. |
| 8 | `budget_variance_pct` | −10 … +30 | Spend above/below plan | Cost overrun and schedule overrun share root causes (rework, overtime, expediting), so it acts as an independent corroborating signal. |
| 9 | `deadline_days_remaining` | 1–180 | Days to the contractual deadline | Supplies the *urgency* half of the risk. The same 15% shortfall is trivial with 120 days left and fatal with 10. |
| 10 | `task_completion_rate_pct` | 0–100 | Share of assigned tasks closed | Count-based completion. Combined with #9 it implies the work rate still required, which is the sharpest derived signal in the set. |

All ten are observable **while the project is still running** — every one is
already captured by the BuildSync tasks, materials and expenses modules.

### 6. How the synthetic relationships were generated

The rows are **not** independent draws per column. Generation is causal, in order:

1. **Latent project health `h ~ N(0,1)`** — never written to the CSV. It stands
   for site management quality, subcontractor reliability and design maturity.
2. `h` drives material shortfall, material delay, labour adequacy, prior delay
   count, progress variance and budget variance **together**. This is what
   produces realistic cross-correlations (e.g. availability ↔ delay days
   r = −0.75) instead of ten independent noise columns.
3. Structural relations are layered on: crew size scales with project size;
   `task_completion_rate ≈ planned progress + progress variance + noise`;
   `deadline_days_remaining = planned − elapsed + re-baselining adjustment`.
4. **Target**: a logistic function of the *observable* features —
   progress variance, material availability and delay, prior delays, budget
   variance, deadline pressure, completion rate, labour adequacy, and the
   required work-rate ratio `(100 − completion) / days_remaining` — plus an
   **unobserved shock `N(0, 0.9)`** representing weather, permits and
   subcontractor churn. The intercept is bisection-calibrated so the marginal
   delay rate lands on exactly 30%.
5. `delay` is then a **Bernoulli draw**, not a threshold. Nothing is
   deterministic.

**Deliberate non-separability.** The unobserved shock caps how well *any* model
can do on these ten columns at **83.5% accuracy** (computed by integrating the
shock out at generation time). 21.6% of rows sit in the genuinely ambiguous
band `0.30 < p < 0.70`. Behind-schedule projects that finish on time, and
healthy-looking projects that slip, both exist in the file — as they do on site.

**One deliberate confound.** `planned_duration_days` correlates *negatively*
with delay marginally (r = −0.10, because longer projects get bigger crews) but
its effect is *positive* once `labor_count` is held fixed. This Simpson's-paradox
structure is intentional: it rewards a model that reasons about labour adequacy
rather than raw headcount, and it is why single-feature correlation is a poor
guide here.

**Defect found and fixed during validation.** The first generation made
`deadline_days_remaining` an almost exact restatement of `planned − elapsed`,
pushing VIF for `planned_duration_days` to **75.7** — a near-duplicate column.
The re-baselining adjustment was widened and scaled to project size, bringing
max VIF to ~15 and removing the artificial identity.

### 7. Target leakage — confirmation

**No leakage.** Verified mechanically in `validate_dataset.py` §10 and asserted
again in `train_model.py` before any fitting:

- `delay` is dropped from `X`; the split is `X = df.drop("delay", axis=1)`, `y = df["delay"]`.
- **No post-outcome columns exist in the file**: no `actual_duration_days`,
  `final_completion_date`, `delay_status`, `risk_score`, `delay_probability`,
  `risk_level`, or any name matching those patterns.
- Strongest single-feature correlation with the target is **0.572**
  (`progress_variance_pct`) — informative, nowhere near leakage territory.
- **No feature perfectly determines the target** (checked by grouping on each
  feature and confirming both classes appear).
- No ID column exists, so no identifier can be memorised.
- The generating probability itself was discarded and never written to disk.

Both scripts **exit non-zero** if any of these fail, so leakage cannot silently
reach training.

### 8. Recommended train/test split

**Stratified 80/20 hold-out, `random_state=42`** — 8,000 train / 2,000 test,
delay rate preserved at ~30.3% in both.

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
```

Stratification matters at a 30% positive rate; an unstratified split can shift
the test base rate by a couple of points and move every metric with it.
Model selection and threshold tuning run on **5-fold stratified CV inside the
training set only** — the test set is touched exactly once, at final evaluation.
2,000 test rows give roughly ±2% precision on an accuracy estimate, which is
adequate here. Use `StratifiedKFold` on the full dataset instead if you later
want tighter estimates and don't need a locked hold-out.

---

## Part 2 — Model

### Validation gate

All eleven pre-training checks pass: 10,000 rows, 11 columns, 10 features,
0 missing, 0 duplicates, 0 infinite, binary 0/1 target, 30.35% delay rate, all
numeric, no constant columns, no leakage.

### Model comparison (5-fold stratified CV on the training set, ROC-AUC)

| Model | CV ROC-AUC | std | CV F1 | Best params |
|---|---|---|---|---|
| **Logistic Regression** | **0.8858** | 0.0102 | 0.6993 | `C=10.0` |
| XGBoost | 0.8826 | 0.0092 | 0.6936 | `max_depth=3, min_child_weight=1` |
| Random Forest | 0.8808 | 0.0093 | 0.6856 | `max_depth=8, min_samples_leaf=1` |

**These three are a statistical tie** — the spread (0.005) is half of one
standard deviation. Logistic Regression is selected not because it is more
accurate but because, at equal accuracy, it is the smallest artifact (3 KB),
the fastest to score, and the easiest to defend line-by-line in a dashboard.

> **Caveat worth stating plainly:** the target was *generated* as a logistic
> function of the features, so Logistic Regression is close to the true model
> by construction. This tie is partly an artifact of synthetic data. On real
> BuildSync data — with threshold effects, interactions and non-linearities —
> expect the gradient-boosted model to pull ahead. Re-run this comparison
> before committing to a model in production.

### Held-out test performance (2,000 rows, used once)

| Threshold | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Brier |
|---|---|---|---|---|---|---|---|
| 0.50 (default) | 0.8260 | 0.7467 | 0.6458 | 0.6926 | 0.8900 | 0.7905 | 0.1205 |
| **0.35 (best F1)** | **0.8170** | **0.6714** | **0.7776** | **0.7206** | 0.8900 | 0.7905 | 0.1205 |
| 0.17 (high recall) | 0.7340 | 0.5363 | 0.9127 | 0.6756 | 0.8900 | 0.7905 | 0.1205 |

Thresholds were tuned on **out-of-fold training predictions**, never on the test set.

- Majority-class baseline accuracy: **0.6965**
- Model accuracy at the tuned threshold: **0.8170** (+0.1205)
- Generation-time Bayes ceiling: **0.8350**

At the default threshold the model reaches **0.826 against a ceiling of 0.835** —
essentially all of the learnable signal has been extracted. The remaining gap is
irreducible noise, not a modelling deficiency; more tuning will not close it.

**Which threshold to ship.** 0.35 is the saved default. On site, a missed delay
(schedule slip, liquidated damages) costs far more than a false alarm (one extra
review), so 0.17 is defensible once the dashboard UX is settled — it catches 91%
of delays at the cost of reviewing ~24% of on-time projects. Full sweep in
`reports/threshold_sweep.csv`; switch with `bundle["threshold_high_recall"]`.

### Explainability (SHAP)

Global importance, mean |SHAP| in log-odds, cross-checked against permutation
importance (the top four agree on both measures):

| Feature | mean\|SHAP\| | Direction |
|---|---|---|
| `progress_variance_pct` | 0.764 | higher → **less** risk |
| `deadline_days_remaining` | 0.677 | higher → **less** risk |
| `previous_delay_count` | 0.429 | higher → **more** risk |
| `task_completion_rate_pct` | 0.407 | higher → **less** risk |
| `planned_duration_days` | 0.362 | higher → **more** risk |
| `budget_variance_pct` | 0.346 | higher → **more** risk |
| `elapsed_days` | 0.218 | higher → **less** risk |
| `material_availability_pct` | 0.210 | higher → **less** risk |
| `labor_count` | 0.141 | higher → **less** risk |
| `material_delay_days` | 0.038 | higher → **more** risk |

Every direction matches construction intuition. Plots in `reports/`:
`shap_global_importance.png`, `shap_beeswarm.png`,
`shap_dependence_top_feature.png`, `shap_local_example.png`.

**Reading `planned_duration_days` correctly.** SHAP says longer → riskier, while
raw correlation says the opposite (r = −0.10). Both are right: the model holds
`labor_count` fixed, and at a fixed crew size a longer project *is* riskier.
Surface this one in the UI as *"crew is thin for a job this size"* rather than
*"long projects are risky"*, or it will read as a bug to site managers.

`material_delay_days` ranks last on both SHAP and permutation importance — not
because materials don't matter, but because its effect is already absorbed by
`material_availability_pct` (r = −0.75) and `progress_variance_pct`.

**Local explanations work per project** — the highest-risk test project (p=0.999)
breaks down as `progress_variance_pct = −40` (+3.13), `previous_delay_count = 8`
(+1.23), `deadline_days_remaining = 1` (+1.19). This is exactly the per-project
"why is this flagged" panel the dashboard needs.

### Saved artifact

`models/buildsync_delay_model.joblib` (3 KB) — a dict bundle:

| Key | Contents |
|---|---|
| `model` | fitted `Pipeline(StandardScaler → LogisticRegression)` |
| `feature_names` | the 10 columns **in the exact order the model expects** |
| `threshold` / `threshold_high_recall` | 0.35 / 0.17 |
| `test_metrics`, `shap_importance`, `feature_direction` | for the dashboard |

The backend needs no new dependencies to score it — `backend/requirements.txt`
already has pandas, numpy, scikit-learn and joblib. `xgboost`, `shap` and
`matplotlib` are **training-time only** and are pinned separately in
`ml/requirements.txt`.

```python
import joblib, pandas as pd
b = joblib.load("ml/models/buildsync_delay_model.joblib")
row = pd.DataFrame([{...}])[b["feature_names"]]     # order matters
proba = b["model"].predict_proba(row)[0, 1]
flagged = proba >= b["threshold"]
```

### Known limitations

1. **The data is synthetic.** Every metric here measures how well the model
   recovers a relationship that was written by hand. It says nothing yet about
   real construction sites. Treat these numbers as a pipeline smoke test, not
   as expected production performance.
2. **Logistic Regression's win is partly self-fulfilling** (see caveat above).
3. **Correlated features make LR coefficients hard to read individually** —
   `progress_variance_pct` ↔ `budget_variance_pct` is r = −0.83. Use SHAP, not
   raw coefficients, for the dashboard explanations.
4. **No temporal validation.** Real delay data is time-ordered and drifts; a
   random split will look optimistic against a forward-in-time split.
5. **No calibration layer.** Brier is 0.1205 and probabilities are reasonable,
   but if the UI shows a literal "68% risk" figure, add `CalibratedClassifierCV`
   and check a reliability curve first.

---

## Part 3 — The train/serve gap

Everything above measures how well the model recovers a relationship written
by `generate_dataset.py`. It says nothing about the second question, which is
now the larger source of error: **the ten features scored in production are
not the ten features the model was trained on.**

`backend/app/ai/delay_model.py::build_features` maps live BuildSync records
onto the trained columns. Four of those mappings are approximations, and they
are worth stating as plainly as the modelling assumptions are.

| Feature | Trained on | Served from | Status |
|---|---|---|---|
| `previous_delay_count` | Count of prior delay *events* on a project, 0–8 | Tasks in `delayed` status, rescaled against a typical 25-task decomposition | Approximation |
| `labor_count` | Workers assigned | Latest site report that recorded a headcount | Faithful when recorded; **project goes unscored when not** |
| `material_availability_pct` | Share of required materials on site | Share of material lines holding enough cover to outlast a reorder | **Deliberately different** |
| `deadline_days_remaining` | Days to contractual deadline, 1–180 | Real days, clamped | Faithful |
| `planned_duration_days`, `elapsed_days` | 30–365 day builds | Real span rescaled into the trained range, preserving lifecycle position | Approximation |

Three of these were tightened after the first end-to-end review:

1. **`previous_delay_count` no longer saturates.** A raw delayed-task count
   passes the trained ceiling of 8 on any reasonably sized project, and
   `_clamp` then scored 20 slipped tasks out of 200 identically to 8 out of
   10. The count is now expressed as a rate and restated against a typical
   decomposition, so a normally-planned project keeps roughly its absolute
   count and only finely-sliced ones are discounted. Projects that genuinely
   slip past the ceiling still clamp there — that is the model's evidence
   running out, which is what clamping is for.

2. **A missing headcount no longer becomes a headcount of five.** `labor_count`
   previously defaulted to 0 and was clamped up to the training floor, so a
   project nobody had filed a worker count for scored as the smallest crew the
   model ever saw — which, given the Simpson's-paradox structure in §6, reads
   as severely under-resourced on exactly the projects least is known about.
   An unrecorded feature now returns `None` and the project is reported as
   unscored.

3. **`deadline_days_remaining` is no longer rescaled.** Duration and elapsed
   days are still rescaled into the trained window, because lifecycle position
   is what the model learned. Urgency is not proportional in the same way: the
   model learned that ten days left is an emergency and 120 days is not, and
   that is a fact about calendars. Rescaling turned a 760-day job with 158 real
   days of float into 76 model-days and read as roughly three times riskier
   than it was.

**Measured effect on the seeded portfolio (8 projects).** Seven move by 1.7
points or less. Skyline Tower moves from 42.1% to 29.4% and stops being
flagged: it has 329 real days remaining, which the old rescaling compressed to
158 and read as schedule pressure that does not exist. No project became
unscored, because every seeded project records a headcount.

That last point is worth noting before a demo: **at the shipped 0.35 threshold
the seeded portfolio now flags nothing.** The scores are more faithful, but if
the dashboard needs to show the flagging path working, `threshold_high_recall`
(0.17) is already in the bundle and flags Skyline Tower.

### What this part still does not establish

- The mapping table above is **unvalidated**. No real project has been scored
  and its outcome observed, so the approximations are reasoned, not measured.
- `TYPICAL_TASK_COUNT = 25` is calibrated to how BuildSync projects happen to
  be planned today, not to anything in the training data. It is the first
  constant to revisit against real projects.
- The `material_availability_pct` redefinition is defensible (the naive ratio
  reads ~3% on every healthy project mid-build) but it means the served
  feature and the trained feature measure different quantities, and no amount
  of model-side rigour fixes that.
- There are no automated tests over `build_features`. The numbers in this
  section were produced by scoring the bundle directly against the seeded
  database and comparing against the previous implementation.
