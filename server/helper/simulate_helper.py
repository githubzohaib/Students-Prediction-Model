"""What-if simulation: goal seeking and multi-scenario comparison."""

from __future__ import annotations

import numpy as np

from config.ml_model import registry
from helper.prediction_helper import (
    grade_for,
    model_stamp,
    percentile_for,
    predict_many,
    predict_one,
    prediction_interval,
    profile_dict,
    to_vector,
)

GRID_POINTS = 400


def goal_seek(profile, target_score: float, lever: str,
              model_key: str | None = None) -> dict:
    """Solve for the smallest value of ``lever`` that reaches ``target_score``.

    A dense grid sweep is used rather than a bisection because the model is a
    tree ensemble: it is piecewise-constant and not guaranteed monotone, so
    bisection can converge on the wrong side of a step.
    """
    feat = registry.feature(lever)
    index = registry.feature_keys.index(lever)

    vector = to_vector(profile)
    current_value = float(vector[index])
    current_score = predict_one(vector, model_key)

    grid = np.linspace(feat["min"], feat["max"], GRID_POINTS)
    probes = np.tile(vector, (GRID_POINTS, 1))
    probes[:, index] = grid
    scores = predict_many(probes, model_key)

    max_achievable = float(np.max(scores))
    unit = feat["unit"]

    # Only consider raising the lever above its current value.
    reachable = np.where((scores >= target_score) & (grid >= current_value))[0]

    if target_score <= current_score:
        return {
            "feasible": True,
            "lever": lever,
            "lever_label": feat["label"],
            "unit": unit,
            "current_value": round(current_value, 2),
            "required_value": round(current_value, 2),
            "delta": 0.0,
            "target_score": target_score,
            "current_score": round(current_score, 2),
            "achieved_score": round(current_score, 2),
            "max_achievable_score": round(max_achievable, 2),
            "message": (
                f"Already there — the predicted score of {current_score:.1f} "
                f"meets the {target_score:g} target."
            ),
        }

    if len(reachable) == 0:
        return {
            "feasible": False,
            "lever": lever,
            "lever_label": feat["label"],
            "unit": unit,
            "current_value": round(current_value, 2),
            "required_value": None,
            "delta": None,
            "target_score": target_score,
            "current_score": round(current_score, 2),
            "achieved_score": round(max_achievable, 2),
            "max_achievable_score": round(max_achievable, 2),
            "message": (
                f"Unreachable through {feat['label'].lower()} alone. Even at the "
                f"maximum of {feat['max']:g}, the model predicts "
                f"{max_achievable:.1f} — short of the {target_score:g} target."
            ),
        }

    first = int(reachable[0])
    required = float(grid[first])
    achieved = float(scores[first])

    return {
        "feasible": True,
        "lever": lever,
        "lever_label": feat["label"],
        "unit": unit,
        "current_value": round(current_value, 2),
        "required_value": round(required, 2),
        "delta": round(required - current_value, 2),
        "target_score": target_score,
        "current_score": round(current_score, 2),
        "achieved_score": round(achieved, 2),
        "max_achievable_score": round(max_achievable, 2),
        "message": (
            f"Raise {feat['label'].lower()} from {current_value:g} to "
            f"{required:.1f} (+{required - current_value:.1f}) to reach a "
            f"predicted {achieved:.1f}."
        ),
    }


def compare_scenarios(scenarios, model_key: str | None = None) -> dict:
    """Score several named profiles and rank them against the first one."""
    results = []
    baseline_score: float | None = None

    for scenario in scenarios:
        vector = to_vector(scenario)
        interval = prediction_interval(vector, model_key)
        score = predict_one(vector, model_key)

        if baseline_score is None:
            baseline_score = score

        results.append({
            "name": scenario.name,
            "inputs": profile_dict(vector),
            "predicted_score": round(score, 2),
            "grade": grade_for(score)["grade"],
            "percentile": percentile_for(score),
            "confidence": interval,
            "delta_vs_baseline": round(score - baseline_score, 2),
        })

    scores = [r["predicted_score"] for r in results]
    best = max(results, key=lambda r: r["predicted_score"])
    worst = min(results, key=lambda r: r["predicted_score"])

    return {
        "results": results,
        "best": best["name"],
        "worst": worst["name"],
        "spread": round(max(scores) - min(scores), 2),
        "model_used": model_stamp(model_key),
    }
