"""Model registry.

Loads every artifact produced by ``model/train_model.py`` once at process
start and exposes them through a single ``registry`` object. Estimators are
loaded lazily so that booting the API only pays for the champion model.
"""

from __future__ import annotations

import json
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = BASE_DIR / "model" / "artifacts"
METADATA_PATH = ARTIFACT_DIR / "metadata.json"
BACKGROUND_PATH = ARTIFACT_DIR / "background.npy"


class ArtifactsMissingError(RuntimeError):
    """Raised when the API is started before the training pipeline has run."""


class ModelRegistry:
    """Thread-safe accessor for the trained estimators and their metadata."""

    def __init__(self, artifact_dir: Path = ARTIFACT_DIR) -> None:
        self.artifact_dir = artifact_dir
        self._lock = threading.Lock()
        self._estimators: dict[str, Any] = {}
        self._metadata: dict | None = None
        self._background: np.ndarray | None = None

    # -- loading ---------------------------------------------------------

    def load(self) -> None:
        """Eagerly load metadata, the background sample and the champion."""
        if not METADATA_PATH.exists():
            raise ArtifactsMissingError(
                f"No metadata.json at {METADATA_PATH}. "
                "Run `python model/train_model.py` first."
            )

        with open(METADATA_PATH, encoding="utf-8") as fh:
            self._metadata = json.load(fh)

        if BACKGROUND_PATH.exists():
            self._background = np.load(BACKGROUND_PATH)
        else:
            raise ArtifactsMissingError(f"No background.npy at {BACKGROUND_PATH}.")

        # Warm the champion so the first request is not slow.
        self.estimator(self.champion_key)

    @property
    def ready(self) -> bool:
        return self._metadata is not None

    # -- metadata --------------------------------------------------------

    @property
    def metadata(self) -> dict:
        if self._metadata is None:
            raise ArtifactsMissingError("Model registry has not been loaded.")
        return self._metadata

    @property
    def champion_key(self) -> str:
        return self.metadata["champion"]

    @property
    def model_keys(self) -> list[str]:
        return [m["key"] for m in self.metadata["models"]]

    def model_record(self, key: str) -> dict:
        for record in self.metadata["models"]:
            if record["key"] == key:
                return record
        raise KeyError(key)

    @property
    def features(self) -> list[dict]:
        return self.metadata["features"]

    @property
    def feature_keys(self) -> list[str]:
        return [f["key"] for f in self.features]

    def feature(self, key: str) -> dict:
        for feat in self.features:
            if feat["key"] == key:
                return feat
        raise KeyError(key)

    @property
    def grades(self) -> list[dict]:
        return self.metadata["grades"]

    @property
    def background(self) -> np.ndarray:
        if self._background is None:
            raise ArtifactsMissingError("Background sample has not been loaded.")
        return self._background

    @property
    def baseline_prediction(self) -> float:
        return float(self.metadata["baseline_prediction"])

    @property
    def analytics(self) -> dict:
        return self.metadata["analytics"]

    # -- estimators ------------------------------------------------------

    def resolve_key(self, key: str | None) -> str:
        """Normalise a requested model key, falling back to the champion."""
        if not key:
            return self.champion_key
        if key not in self.model_keys:
            raise KeyError(key)
        return key

    def estimator(self, key: str | None = None):
        resolved = self.resolve_key(key)

        if resolved in self._estimators:
            return self._estimators[resolved]

        with self._lock:
            # Double-checked: another thread may have loaded it while we waited.
            if resolved not in self._estimators:
                path = self.artifact_dir / f"{resolved}.pkl"
                if not path.exists():
                    raise ArtifactsMissingError(f"Missing estimator artifact: {path}")
                self._estimators[resolved] = joblib.load(path)

        return self._estimators[resolved]

    def supports_tree_interval(self, key: str | None = None) -> bool:
        return bool(self.model_record(self.resolve_key(key))["supports_tree_interval"])

    def residual_std(self, key: str | None = None) -> float:
        return float(self.model_record(self.resolve_key(key))["metrics"]["residual_std"])


registry = ModelRegistry()


@lru_cache(maxsize=1)
def score_percentile_table() -> tuple[np.ndarray, np.ndarray]:
    """(scores, percentiles) arrays for interpolating a score's cohort rank."""
    rows = registry.analytics["score_percentiles"]
    percentiles = np.array([r["p"] for r in rows], dtype=np.float64)
    scores = np.array([r["score"] for r in rows], dtype=np.float64)
    return scores, percentiles
