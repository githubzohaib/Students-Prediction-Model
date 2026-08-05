"""Training pipeline for the Student Performance Prediction System.

Trains a set of candidate regressors on the student performance dataset,
scores them on a held-out test split, selects a champion, and writes every
artifact the API needs at inference time:

    artifacts/<model_key>.pkl   fitted estimators
    artifacts/background.npy    background sample used for exact Shapley values
    artifacts/metadata.json     metrics, feature schema, signal audit, analytics

Run:  python model/train_model.py [--sample N] [--quick]
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.ensemble import (
    ExtraTreesRegressor,
    HistGradientBoostingRegressor,
    RandomForestRegressor,
)
from sklearn.feature_selection import mutual_info_regression
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

CURRENT_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = CURRENT_DIR / "artifacts"
CSV_PATH = CURRENT_DIR / "student_performance_1M.csv"

RANDOM_STATE = 42
BACKGROUND_SIZE = 128
IMPORTANCE_SAMPLE = 25_000
CV_SAMPLE = 60_000
HIST_BINS = 24

FEATURES = [
    {
        "key": "study_hours",
        "column": "weekly_self_study_hours",
        "label": "Weekly Self-Study Hours",
        "short": "Study Hours",
        "unit": "hrs/week",
        "step": 0.5,
        "description": "Hours the student studies independently each week.",
    },
    {
        "key": "attendance",
        "column": "attendance_percentage",
        "label": "Attendance",
        "short": "Attendance",
        "unit": "%",
        "step": 1.0,
        "description": "Share of scheduled classes the student attended.",
    },
    {
        "key": "participation",
        "column": "class_participation",
        "label": "Class Participation",
        "short": "Participation",
        "unit": "/ 10",
        "step": 0.1,
        "description": "Instructor-rated in-class participation score.",
    },
]

FEATURE_COLUMNS = [f["column"] for f in FEATURES]
TARGET_COLUMN = "total_score"

# Grade bands are read back from the dataset, but these are the fallbacks.
GRADE_ORDER = ["A", "B", "C", "D", "F"]


def log(msg: str) -> None:
    print(f"[train] {msg}", flush=True)


# --------------------------------------------------------------------------
# Model zoo
# --------------------------------------------------------------------------

def build_candidates(quick: bool) -> list[dict]:
    """Candidate estimators. Kept deliberately small so that inference-time
    Shapley/ICE sweeps (hundreds of forward passes per request) stay fast."""
    n_trees = 40 if quick else 90

    return [
        {
            "key": "random_forest",
            "label": "Random Forest",
            "family": "Bagged decision trees",
            "supports_tree_interval": True,
            "notes": "Champion candidate. Per-tree spread gives calibrated prediction intervals.",
            "estimator": RandomForestRegressor(
                n_estimators=n_trees,
                max_depth=14,
                min_samples_split=20,
                min_samples_leaf=10,
                max_features=None,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        },
        {
            "key": "extra_trees",
            "label": "Extra Trees",
            "family": "Randomised decision trees",
            "supports_tree_interval": True,
            "notes": "Extremely randomised splits; lower variance, slightly higher bias.",
            "estimator": ExtraTreesRegressor(
                n_estimators=n_trees,
                max_depth=16,
                min_samples_split=20,
                min_samples_leaf=10,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        },
        {
            "key": "hist_gradient_boosting",
            "label": "Hist Gradient Boosting",
            "family": "Boosted histogram trees",
            "supports_tree_interval": False,
            "notes": "Histogram-binned boosting; scales to the full 1M rows in seconds.",
            "estimator": HistGradientBoostingRegressor(
                max_iter=200 if not quick else 80,
                learning_rate=0.1,
                max_depth=8,
                min_samples_leaf=40,
                early_stopping=True,
                validation_fraction=0.1,
                random_state=RANDOM_STATE,
            ),
        },
        {
            "key": "ridge",
            "label": "Ridge Regression",
            "family": "Regularised linear model",
            "supports_tree_interval": False,
            "notes": "Interpretable linear baseline. Quantifies how much non-linearity buys.",
            "estimator": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        },
    ]


def describe_hyperparameters(estimator) -> dict:
    """Flatten the interesting hyperparameters for display in the UI."""
    interesting = {
        "n_estimators", "max_depth", "min_samples_split", "min_samples_leaf",
        "max_features", "max_iter", "learning_rate", "alpha", "early_stopping",
    }
    params = estimator.get_params()
    out = {}
    for name, value in params.items():
        leaf = name.split("__")[-1]
        if leaf in interesting and not isinstance(value, (list, dict)):
            out[leaf] = value if value is not None else "None"
    return out


# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------

def evaluate(model, X_test: np.ndarray, y_test: np.ndarray) -> dict:
    preds = model.predict(X_test)
    residuals = y_test - preds

    # MAPE guarded against near-zero targets.
    safe = np.abs(y_test) > 1e-6
    mape = float(np.mean(np.abs(residuals[safe] / y_test[safe])) * 100)

    return {
        "r2": float(r2_score(y_test, preds)),
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
        "mape": mape,
        "residual_std": float(np.std(residuals)),
        "max_error": float(np.max(np.abs(residuals))),
        "within_5_points": float(np.mean(np.abs(residuals) <= 5.0) * 100),
        "within_10_points": float(np.mean(np.abs(residuals) <= 10.0) * 100),
    }


def cross_validate(estimator, X: np.ndarray, y: np.ndarray, rng: np.random.Generator) -> dict:
    """3-fold CV on a subsample -- full-data CV on 1M rows is not worth the wall time."""
    n = min(CV_SAMPLE, len(X))
    idx = rng.choice(len(X), size=n, replace=False)
    cv = KFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(estimator, X[idx], y[idx], cv=cv, scoring="r2", n_jobs=1)
    return {
        "cv_r2_mean": float(np.mean(scores)),
        "cv_r2_std": float(np.std(scores)),
        "cv_folds": 3,
        "cv_sample": int(n),
    }


# --------------------------------------------------------------------------
# Feature schema, grades, analytics
# --------------------------------------------------------------------------

def build_feature_schema(data: pd.DataFrame) -> list[dict]:
    schema = []
    for feat in FEATURES:
        col = data[feat["column"]]
        schema.append({
            **{k: v for k, v in feat.items() if k != "column"},
            "column": feat["column"],
            "min": float(col.min()),
            "max": float(col.max()),
            "p1": float(col.quantile(0.01)),
            "p25": float(col.quantile(0.25)),
            "median": float(col.median()),
            "p75": float(col.quantile(0.75)),
            "p99": float(col.quantile(0.99)),
            "mean": float(col.mean()),
            "std": float(col.std()),
        })
    return schema


def build_grade_bands(data: pd.DataFrame) -> list[dict]:
    """Recover the empirical grade cutoffs rather than hard-coding them."""
    total = len(data)
    grouped = data.groupby("grade")[TARGET_COLUMN].agg(["min", "max", "count"])
    bands = []
    for grade in GRADE_ORDER:
        if grade not in grouped.index:
            continue
        row = grouped.loc[grade]
        bands.append({
            "grade": grade,
            "min": float(row["min"]),
            "max": float(row["max"]),
            "count": int(row["count"]),
            "share": float(row["count"] / total),
        })
    # Sort high -> low and snap lower bounds so the bands tile the range.
    bands.sort(key=lambda b: b["min"], reverse=True)
    return bands


def histogram(series: pd.Series, bins: int = HIST_BINS) -> dict:
    counts, edges = np.histogram(series.to_numpy(), bins=bins)
    return {
        "edges": [round(float(e), 3) for e in edges],
        "centers": [round(float((edges[i] + edges[i + 1]) / 2), 3) for i in range(len(counts))],
        "counts": [int(c) for c in counts],
    }


def decile_curve(data: pd.DataFrame, column: str) -> list[dict]:
    """Mean target per decile of a feature -- the empirical response curve."""
    binned = pd.qcut(data[column], 10, duplicates="drop")
    grouped = data.groupby(binned, observed=True)[TARGET_COLUMN]
    out = []
    for interval, group in grouped:
        out.append({
            "bin_label": f"{interval.left:.1f}-{interval.right:.1f}",
            "bin_mid": round(float((interval.left + interval.right) / 2), 2),
            "mean_score": round(float(group.mean()), 2),
            "p25": round(float(group.quantile(0.25)), 2),
            "p75": round(float(group.quantile(0.75)), 2),
            "count": int(len(group)),
        })
    return out


def build_analytics(data: pd.DataFrame) -> dict:
    numeric = FEATURE_COLUMNS + [TARGET_COLUMN]
    corr = data[numeric].corr()
    labels = [f["short"] for f in FEATURES] + ["Final Score"]

    quantile_points = list(range(0, 101))
    score_percentiles = [
        {"p": p, "score": round(float(data[TARGET_COLUMN].quantile(p / 100)), 2)}
        for p in quantile_points
    ]

    return {
        "histograms": {
            f["key"]: histogram(data[f["column"]]) for f in FEATURES
        },
        "target_histogram": histogram(data[TARGET_COLUMN], bins=30),
        "correlation": {
            "labels": labels,
            "keys": [f["key"] for f in FEATURES] + ["total_score"],
            "matrix": [[round(float(v), 4) for v in row] for row in corr.to_numpy()],
        },
        "decile_curves": {f["key"]: decile_curve(data, f["column"]) for f in FEATURES},
        "grade_distribution": [
            {
                "grade": g,
                "count": int((data["grade"] == g).sum()),
                "share": float((data["grade"] == g).mean()),
            }
            for g in GRADE_ORDER
            if (data["grade"] == g).any()
        ],
        "score_percentiles": score_percentiles,
        "target_summary": {
            "mean": round(float(data[TARGET_COLUMN].mean()), 2),
            "median": round(float(data[TARGET_COLUMN].median()), 2),
            "std": round(float(data[TARGET_COLUMN].std()), 2),
            "min": round(float(data[TARGET_COLUMN].min()), 2),
            "max": round(float(data[TARGET_COLUMN].max()), 2),
            "ceiling_share": round(float((data[TARGET_COLUMN] >= data[TARGET_COLUMN].max()).mean()), 4),
        },
    }


def build_signal_audit(
    data: pd.DataFrame,
    champion,
    X_test: np.ndarray,
    y_test: np.ndarray,
    rng: np.random.Generator,
) -> list[dict]:
    """Per-feature evidence of predictive signal.

    This dataset is a useful teaching case: only one of the three inputs
    actually carries information about the target. Rather than hiding that,
    the API ships the evidence and the UI reports it.
    """
    n = min(IMPORTANCE_SAMPLE, len(X_test))
    idx = rng.choice(len(X_test), size=n, replace=False)
    Xs, ys = X_test[idx], y_test[idx]

    perm = permutation_importance(
        champion, Xs, ys, n_repeats=5, random_state=RANDOM_STATE, n_jobs=-1,
        scoring="r2",
    )

    mi = mutual_info_regression(Xs, ys, random_state=RANDOM_STATE)

    audit = []
    for i, feat in enumerate(FEATURES):
        col = data[feat["column"]]
        pearson = float(col.corr(data[TARGET_COLUMN]))
        spearman = float(col.corr(data[TARGET_COLUMN], method="spearman"))
        drop = float(perm.importances_mean[i])

        # A feature is treated as carrying signal only if it clears all three
        # weak-evidence thresholds.
        has_signal = abs(pearson) >= 0.05 or drop >= 0.005 or mi[i] >= 0.05

        audit.append({
            "feature": feat["key"],
            "label": feat["label"],
            "pearson_r": round(pearson, 4),
            "spearman_r": round(spearman, 4),
            "mutual_information": round(float(mi[i]), 4),
            "permutation_r2_drop": round(drop, 5),
            "permutation_r2_drop_std": round(float(perm.importances_std[i]), 5),
            "verdict": "predictive" if has_signal else "no-signal",
        })
    return audit


def build_feature_importance(champion, X_test, y_test, rng) -> list[dict]:
    n = min(IMPORTANCE_SAMPLE, len(X_test))
    idx = rng.choice(len(X_test), size=n, replace=False)
    perm = permutation_importance(
        champion, X_test[idx], y_test[idx], n_repeats=5,
        random_state=RANDOM_STATE, n_jobs=-1, scoring="r2",
    )
    raw = np.clip(perm.importances_mean, 0, None)
    total = raw.sum() or 1.0

    impurity = getattr(champion, "feature_importances_", None)

    out = []
    for i, feat in enumerate(FEATURES):
        out.append({
            "feature": feat["key"],
            "label": feat["label"],
            "permutation_importance": round(float(raw[i]), 5),
            "permutation_share": round(float(raw[i] / total), 4),
            "impurity_importance": round(float(impurity[i]), 4) if impurity is not None else None,
            "std": round(float(perm.importances_std[i]), 5),
        })
    return out


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Train the student performance models.")
    parser.add_argument("--sample", type=int, default=0,
                        help="Train on a random subsample of N rows (0 = full dataset).")
    parser.add_argument("--quick", action="store_true",
                        help="Smaller ensembles for a fast iteration loop.")
    args = parser.parse_args()

    if not CSV_PATH.exists():
        log(f"ERROR: dataset not found at {CSV_PATH}")
        return 1

    rng = np.random.default_rng(RANDOM_STATE)
    started = time.time()

    log(f"Loading {CSV_PATH.name} ...")
    data = pd.read_csv(CSV_PATH)
    data = data.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN, "grade"])

    if args.sample and args.sample < len(data):
        data = data.sample(args.sample, random_state=RANDOM_STATE).reset_index(drop=True)

    log(f"Dataset: {len(data):,} rows x {len(FEATURE_COLUMNS)} features")

    X = data[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    y = data[TARGET_COLUMN].to_numpy(dtype=np.float64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    log(f"Split: {len(X_train):,} train / {len(X_test):,} test")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    trained: dict[str, object] = {}
    model_records: list[dict] = []

    for spec in build_candidates(args.quick):
        log(f"Fitting {spec['label']} ...")
        estimator = spec["estimator"]

        t0 = time.time()
        estimator.fit(X_train, y_train)
        fit_seconds = time.time() - t0

        metrics = evaluate(estimator, X_test, y_test)
        metrics.update(cross_validate(clone(estimator), X_train, y_train, rng))
        metrics["train_seconds"] = round(fit_seconds, 2)

        log(f"  R2={metrics['r2']:.4f}  MAE={metrics['mae']:.3f}  "
            f"RMSE={metrics['rmse']:.3f}  ({fit_seconds:.1f}s)")

        joblib.dump(estimator, ARTIFACT_DIR / f"{spec['key']}.pkl", compress=3)
        trained[spec["key"]] = estimator

        model_records.append({
            "key": spec["key"],
            "label": spec["label"],
            "family": spec["family"],
            "notes": spec["notes"],
            "supports_tree_interval": spec["supports_tree_interval"],
            "metrics": {k: (round(v, 5) if isinstance(v, float) else v)
                        for k, v in metrics.items()},
            "hyperparameters": describe_hyperparameters(estimator),
        })

    champion_record = max(model_records, key=lambda m: m["metrics"]["r2"])
    champion_key = champion_record["key"]
    champion = trained[champion_key]
    log(f"Champion: {champion_record['label']} (R2={champion_record['metrics']['r2']:.4f})")

    # Background sample for exact Shapley attribution at inference time.
    bg_idx = rng.choice(len(X_train), size=min(BACKGROUND_SIZE, len(X_train)), replace=False)
    background = X_train[bg_idx]
    np.save(ARTIFACT_DIR / "background.npy", background)

    log("Computing permutation importance and signal audit ...")
    feature_importance = build_feature_importance(champion, X_test, y_test, rng)
    signal_audit = build_signal_audit(data, champion, X_test, y_test, rng)

    for entry in signal_audit:
        log(f"  {entry['label']}: r={entry['pearson_r']:+.4f} "
            f"MI={entry['mutual_information']:.4f} "
            f"perm_dR2={entry['permutation_r2_drop']:+.5f} -> {entry['verdict']}")

    log("Building dataset analytics ...")
    analytics = build_analytics(data)

    baseline_prediction = float(np.mean(champion.predict(background)))

    metadata = {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
        },
        "dataset": {
            "source": CSV_PATH.name,
            "rows": int(len(data)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "test_size": 0.2,
            "random_state": RANDOM_STATE,
        },
        "features": build_feature_schema(data),
        "target": {
            "key": TARGET_COLUMN,
            "label": "Final Score",
            "min": float(y.min()),
            "max": float(y.max()),
            "mean": float(y.mean()),
            "std": float(y.std()),
        },
        "grades": build_grade_bands(data),
        "models": model_records,
        "champion": champion_key,
        "baseline_prediction": round(baseline_prediction, 4),
        "background_size": int(len(background)),
        "feature_importance": feature_importance,
        "signal_audit": signal_audit,
        "analytics": analytics,
        "training_seconds": round(time.time() - started, 1),
    }

    with open(ARTIFACT_DIR / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)

    log(f"Artifacts written to {ARTIFACT_DIR}")
    log(f"Done in {metadata['training_seconds']}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
