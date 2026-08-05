"""Core scoring logic: point prediction, uncertainty, grading, risk, levers."""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np

from config.ml_model import registry, score_percentile_table

# Score below which a student is considered to be failing to keep pace.
PASS_THRESHOLD = 55.0
CONFIDENCE_LEVEL = 0.95
Z_95 = 1.959963985

# A lever must move the prediction by at least this many points before it is
# reported as effective. Anything smaller is inside model noise.
EFFECT_FLOOR = 0.25

# Realistic single-step improvements per feature, used by the lever search.
LEVER_STEPS = {
    "study_hours": [2.0, 5.0],
    "attendance": [5.0, 10.0],
    "participation": [1.0, 2.0],
}

EFFORT_BY_FEATURE = {
    "study_hours": "high",
    "attendance": "medium",
    "participation": "low",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Vectorisation
# ---------------------------------------------------------------------------

def to_vector(profile) -> np.ndarray:
    """Order a profile into the feature vector the estimators were trained on."""
    values = [getattr(profile, key) for key in registry.feature_keys]
    return np.array(values, dtype=np.float64)


def profile_dict(vector: np.ndarray) -> dict:
    return {key: float(v) for key, v in zip(registry.feature_keys, vector)}


def collect_warnings(vector: np.ndarray) -> list[str]:
    """Flag inputs outside the range the model actually saw during training."""
    warnings: list[str] = []
    for value, feat in zip(vector, registry.features):
        if value < feat["min"] or value > feat["max"]:
            warnings.append(
                f"{feat['label']} = {value:g}{_unit_suffix(feat)} is outside the "
                f"training range ({feat['min']:g}-{feat['max']:g}). "
                "The prediction extrapolates and is less reliable."
            )
    return warnings


def _unit_suffix(feat: dict) -> str:
    unit = feat.get("unit", "")
    return "%" if unit == "%" else ""


def clip_to_target(score: float) -> float:
    target = registry.metadata["target"]
    return float(min(max(score, target["min"]), target["max"]))


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict_many(vectors: np.ndarray, model_key: str | None = None) -> np.ndarray:
    """Batch prediction; the single hot path used by every other helper."""
    estimator = registry.estimator(model_key)
    raw = np.asarray(estimator.predict(np.atleast_2d(vectors)), dtype=np.float64)
    target = registry.metadata["target"]
    return np.clip(raw, target["min"], target["max"])


def predict_one(vector: np.ndarray, model_key: str | None = None) -> float:
    return float(predict_many(vector.reshape(1, -1), model_key)[0])


def prediction_interval(
    vector: np.ndarray, model_key: str | None = None
) -> dict:
    """95% interval.

    Tree ensembles expose per-estimator predictions, so the spread across trees
    is a direct estimate of model uncertainty at this point in feature space.
    Models without that structure fall back to the held-out residual spread.
    """
    resolved = registry.resolve_key(model_key)
    point = predict_one(vector, resolved)

    if registry.supports_tree_interval(resolved):
        estimator = registry.estimator(resolved)
        row = vector.reshape(1, -1)
        per_tree = np.array(
            [float(tree.predict(row)[0]) for tree in estimator.estimators_],
            dtype=np.float64,
        )
        std = float(np.std(per_tree))
        method = "tree-ensemble-spread"
        # Tree spread captures model variance but not irreducible noise; fold in
        # the residual spread so the interval is honest about both.
        std = math.sqrt(std**2 + registry.residual_std(resolved) ** 2)
    else:
        std = registry.residual_std(resolved)
        method = "residual-normal"

    margin = Z_95 * std
    return {
        "lower": clip_to_target(point - margin),
        "upper": clip_to_target(point + margin),
        "level": CONFIDENCE_LEVEL,
        "std": round(std, 4),
        "method": method,
    }


# ---------------------------------------------------------------------------
# Grading & cohort position
# ---------------------------------------------------------------------------

def grade_for(score: float) -> dict:
    """Map a score onto the empirical grade bands recovered from the dataset."""
    bands = registry.grades  # sorted high -> low by lower bound
    for band in bands:
        if score >= band["min"]:
            return {"grade": band["grade"], "min": band["min"], "max": band["max"]}
    last = bands[-1]
    return {"grade": last["grade"], "min": last["min"], "max": last["max"]}


def percentile_for(score: float) -> float:
    scores, percentiles = score_percentile_table()
    return round(float(np.interp(score, scores, percentiles)), 1)


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

def assess_risk(
    vector: np.ndarray, score: float, std: float, warnings: list[str]
) -> dict:
    """Probability-of-underperformance risk model.

    Risk is P(true score < PASS_THRESHOLD) under a normal centred on the
    prediction with the interval's standard deviation -- so both a low
    prediction and a high-uncertainty prediction raise risk.
    """
    if std <= 1e-9:
        probability = 1.0 if score < PASS_THRESHOLD else 0.0
    else:
        z = (PASS_THRESHOLD - score) / std
        probability = 0.5 * (1.0 + math.erf(z / math.sqrt(2)))

    risk_score = round(probability * 100, 1)

    if probability < 0.05:
        level, label = "low", "On track"
    elif probability < 0.20:
        level, label = "moderate", "Watch"
    elif probability < 0.50:
        level, label = "elevated", "Needs support"
    else:
        level, label = "high", "At risk"

    factors = []
    values = profile_dict(vector)

    for feat in registry.features:
        value = values[feat["key"]]
        if value < feat["p25"]:
            factors.append({
                "label": f"Low {feat['label'].lower()}",
                "detail": (
                    f"{value:g} sits in the bottom quartile of the cohort "
                    f"(25th percentile is {feat['p25']:g})."
                ),
                "severity": "high" if value < feat["p1"] else "medium",
            })

    cohort_mean = registry.analytics["target_summary"]["mean"]
    if score < cohort_mean:
        factors.append({
            "label": "Below cohort average",
            "detail": f"Predicted {score:.1f} against a cohort mean of {cohort_mean:.1f}.",
            "severity": "medium" if score >= PASS_THRESHOLD else "high",
        })

    if std > 8:
        factors.append({
            "label": "Wide uncertainty band",
            "detail": f"±{Z_95 * std:.1f} points at 95% confidence — treat as indicative.",
            "severity": "medium",
        })

    for warning in warnings:
        factors.append({
            "label": "Out-of-range input",
            "detail": warning,
            "severity": "medium",
        })

    if not factors:
        factors.append({
            "label": "No risk signals",
            "detail": "All inputs sit within healthy cohort ranges.",
            "severity": "low",
        })

    return {"level": level, "label": label, "score": risk_score, "factors": factors}


# ---------------------------------------------------------------------------
# Improvement levers
# ---------------------------------------------------------------------------

def build_recommendations(
    vector: np.ndarray, base_score: float, model_key: str | None = None
) -> list[dict]:
    """Probe each feature with realistic increments and rank by measured gain.

    Every number here comes from the model itself -- nothing is hand-authored,
    so a lever the model considers inert is reported as such.
    """
    candidates: list[dict] = []

    for index, feat in enumerate(registry.features):
        key = feat["key"]
        current = float(vector[index])
        best: dict | None = None

        for step in LEVER_STEPS.get(key, [1.0]):
            proposed = min(current + step, feat["max"])
            if proposed <= current + 1e-9:
                continue

            probe = vector.copy()
            probe[index] = proposed
            new_score = predict_one(probe, model_key)
            gain = new_score - base_score

            if best is None or gain > best["projected_gain"]:
                best = {
                    "feature": key,
                    "label": feat["label"],
                    "delta": round(proposed - current, 2),
                    "projected_gain": round(gain, 2),
                    "projected_score": round(new_score, 2),
                    "effort": EFFORT_BY_FEATURE.get(key, "medium"),
                }

        if best is None:
            # Already at the ceiling for this feature.
            candidates.append({
                "feature": key,
                "label": feat["label"],
                "action": f"{feat['label']} is already at the maximum of {feat['max']:g}.",
                "delta": 0.0,
                "projected_gain": 0.0,
                "projected_score": round(base_score, 2),
                "effort": EFFORT_BY_FEATURE.get(key, "medium"),
                "effective": False,
            })
            continue

        effective = best["projected_gain"] >= EFFECT_FLOOR
        unit = feat["unit"]
        unit_text = "" if unit == "/ 10" else f" {unit}"

        if effective:
            action = (
                f"Raise {feat['label'].lower()} by {best['delta']:g}{unit_text} "
                f"for about +{best['projected_gain']:.1f} points."
            )
        else:
            action = (
                f"Raising {feat['label'].lower()} by {best['delta']:g}{unit_text} "
                f"moves the prediction {best['projected_gain']:+.2f} points — "
                "no measurable effect in this dataset."
            )

        candidates.append({**best, "action": action, "effective": effective})

    candidates.sort(key=lambda c: c["projected_gain"], reverse=True)
    return candidates


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def model_stamp(model_key: str | None = None) -> dict:
    record = registry.model_record(registry.resolve_key(model_key))
    return {
        "key": record["key"],
        "label": record["label"],
        "r2": record["metrics"]["r2"],
        "mae": record["metrics"]["mae"],
    }


def predict_profile(profile, model_key: str | None = None,
                    include_recommendations: bool = True) -> dict:
    """Full single-student prediction payload."""
    vector = to_vector(profile)
    warnings = collect_warnings(vector)

    interval = prediction_interval(vector, model_key)
    score = predict_one(vector, model_key)

    band = grade_for(score)
    cohort_mean = registry.analytics["target_summary"]["mean"]

    recommendations = (
        build_recommendations(vector, score, model_key)
        if include_recommendations else []
    )

    return {
        "predicted_score": round(score, 2),
        "grade": band["grade"],
        "grade_band": band,
        "confidence": interval,
        "risk": assess_risk(vector, score, interval["std"], warnings),
        "percentile": percentile_for(score),
        "cohort_mean": cohort_mean,
        "delta_vs_cohort": round(score - cohort_mean, 2),
        "recommendations": recommendations,
        "warnings": warnings,
        "model_used": model_stamp(model_key),
        "inputs": profile_dict(vector),
        "generated_at": now_iso(),
    }
