"""Model explainability: exact Shapley attribution and sensitivity curves."""

from __future__ import annotations

from itertools import combinations
from math import factorial

import numpy as np

from config.ml_model import registry
from helper.prediction_helper import model_stamp, predict_many, predict_one

NEUTRAL_BAND = 0.05  # contributions smaller than this are reported as neutral


def _coalition_values(
    vector: np.ndarray, model_key: str | None
) -> dict[frozenset[int], float]:
    """v(S) for every subset S of features.

    v(S) = E_background[ f(x_S, z_{-S}) ]: features in S are held at the
    instance's values, the rest are marginalised over the background sample.

    With three features there are only 2^3 = 8 coalitions, so the exact
    Shapley decomposition is computed directly rather than sampled the way
    KernelSHAP would. Every coalition is stacked into one batched forward
    pass.
    """
    background = registry.background
    n_features = len(vector)
    m = len(background)

    subsets = [
        frozenset(subset)
        for size in range(n_features + 1)
        for subset in combinations(range(n_features), size)
    ]

    # Build a single (len(subsets) * m, n_features) design matrix.
    blocks = np.empty((len(subsets) * m, n_features), dtype=np.float64)
    for i, subset in enumerate(subsets):
        block = background.copy()
        for feature_index in subset:
            block[:, feature_index] = vector[feature_index]
        blocks[i * m:(i + 1) * m] = block

    predictions = predict_many(blocks, model_key)

    return {
        subset: float(np.mean(predictions[i * m:(i + 1) * m]))
        for i, subset in enumerate(subsets)
    }


def shapley_attribution(vector: np.ndarray, model_key: str | None = None) -> dict:
    """Exact Shapley values for a single prediction.

    phi_i = sum over S subset of N\\{i} of
            |S|!(n-|S|-1)!/n! * [v(S + i) - v(S)]

    The efficiency property guarantees sum(phi) == v(N) - v(empty), which is
    returned as ``residual`` so the caller can verify it numerically.
    """
    n = len(vector)
    values = _coalition_values(vector, model_key)

    others = list(range(n))
    phi = np.zeros(n, dtype=np.float64)

    for i in range(n):
        rest = [j for j in others if j != i]
        for size in range(len(rest) + 1):
            weight = factorial(size) * factorial(n - size - 1) / factorial(n)
            for subset in combinations(rest, size):
                s = frozenset(subset)
                phi[i] += weight * (values[s | {i}] - values[s])

    baseline = values[frozenset()]
    prediction = predict_one(vector, model_key)

    total_abs = float(np.sum(np.abs(phi))) or 1.0

    contributions = []
    for i, feat in enumerate(registry.features):
        value = float(phi[i])
        if value > NEUTRAL_BAND:
            direction = "positive"
        elif value < -NEUTRAL_BAND:
            direction = "negative"
        else:
            direction = "neutral"

        contributions.append({
            "feature": feat["key"],
            "label": feat["label"],
            "value": float(vector[i]),
            "contribution": round(value, 4),
            "share": round(abs(value) / total_abs, 4),
            "direction": direction,
        })

    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)

    return {
        "baseline": round(baseline, 4),
        "prediction": round(prediction, 4),
        "contributions": contributions,
        "residual": round(prediction - baseline - float(np.sum(phi)), 6),
        "method": "Exact Shapley values over all 2^n coalitions",
        "background_size": int(len(registry.background)),
        "model_used": model_stamp(model_key),
    }


def sensitivity_curves(
    vector: np.ndarray, model_key: str | None = None, resolution: int = 40
) -> dict:
    """Individual conditional expectation curve per feature.

    Sweeps one feature across its full training range while holding the others
    at the student's actual values, so the curve shows the lever available to
    *this* student rather than a cohort average.
    """
    curves = []
    current_prediction = predict_one(vector, model_key)

    for index, feat in enumerate(registry.features):
        grid = np.linspace(feat["min"], feat["max"], resolution)

        probes = np.tile(vector, (resolution, 1))
        probes[:, index] = grid
        ys = predict_many(probes, model_key)

        curves.append({
            "feature": feat["key"],
            "label": feat["label"],
            "unit": feat["unit"],
            "current_value": float(vector[index]),
            "current_prediction": round(current_prediction, 2),
            "min_y": round(float(np.min(ys)), 2),
            "max_y": round(float(np.max(ys)), 2),
            "swing": round(float(np.max(ys) - np.min(ys)), 2),
            "points": [
                {"x": round(float(x), 3), "y": round(float(y), 3)}
                for x, y in zip(grid, ys)
            ],
        })

    # Most influential lever first.
    curves.sort(key=lambda c: c["swing"], reverse=True)

    return {
        "curves": curves,
        "prediction": round(current_prediction, 2),
        "model_used": model_stamp(model_key),
    }


def global_importance() -> dict:
    return {
        "importance": registry.metadata["feature_importance"],
        "signal_audit": registry.metadata["signal_audit"],
        "champion": registry.champion_key,
    }
