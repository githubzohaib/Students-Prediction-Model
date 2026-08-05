"""Batch scoring from uploaded CSV files or JSON arrays."""

from __future__ import annotations

import io

import numpy as np
import pandas as pd

from config.ml_model import registry
from helper.prediction_helper import (
    PASS_THRESHOLD,
    assess_risk,
    grade_for,
    model_stamp,
    now_iso,
    percentile_for,
    predict_many,
)

MAX_ROWS = 5000

# Accepted spellings for each feature column, lower-cased and stripped.
COLUMN_ALIASES: dict[str, set[str]] = {
    "study_hours": {
        "study_hours", "studyhours", "weekly_self_study_hours",
        "self_study_hours", "hours", "study", "weekly_study_hours",
    },
    "attendance": {
        "attendance", "attendance_percentage", "attendance_pct",
        "attendance_percent", "attendance_rate",
    },
    "participation": {
        "participation", "class_participation", "participation_score",
        "engagement",
    },
}

ID_ALIASES = {"student_id", "id", "student", "roll_no", "roll_number", "name"}

# Ranges accepted on input; mirrors the pydantic bounds.
VALID_RANGES = {
    "study_hours": (0.0, 80.0),
    "attendance": (0.0, 100.0),
    "participation": (0.0, 10.0),
}


class BatchParseError(ValueError):
    """The uploaded file could not be interpreted as a student roster."""


def _normalise(name: str) -> str:
    return str(name).strip().lower().replace(" ", "_").replace("-", "_")


def resolve_columns(columns: list[str]) -> tuple[dict[str, str], str | None]:
    """Map the uploaded file's headers onto feature keys."""
    lookup = {_normalise(c): c for c in columns}

    mapping: dict[str, str] = {}
    missing: list[str] = []

    for key, aliases in COLUMN_ALIASES.items():
        match = next((lookup[a] for a in aliases if a in lookup), None)
        if match is None:
            missing.append(key)
        else:
            mapping[key] = match

    if missing:
        raise BatchParseError(
            "Missing required column(s): " + ", ".join(missing) +
            ". Expected headers like: study_hours, attendance, participation."
        )

    id_column = next((lookup[a] for a in ID_ALIASES if a in lookup), None)
    return mapping, id_column


def parse_csv(content: bytes) -> pd.DataFrame:
    if not content.strip():
        raise BatchParseError("The uploaded file is empty.")

    try:
        frame = pd.read_csv(io.BytesIO(content))
    except UnicodeDecodeError:
        frame = pd.read_csv(io.BytesIO(content), encoding="latin-1")
    except pd.errors.EmptyDataError as exc:
        raise BatchParseError("The uploaded file has no parsable rows.") from exc
    except pd.errors.ParserError as exc:
        raise BatchParseError(f"Could not parse the CSV: {exc}") from exc

    if frame.empty:
        raise BatchParseError("The uploaded file has no data rows.")

    if len(frame) > MAX_ROWS:
        raise BatchParseError(
            f"File has {len(frame):,} rows; the limit is {MAX_ROWS:,}."
        )

    return frame


def score_frame(frame: pd.DataFrame, model_key: str | None = None) -> dict:
    """Validate and score every row, keeping per-row errors instead of failing."""
    mapping, id_column = resolve_columns(list(frame.columns))

    rows: list[dict] = []
    valid_vectors: list[np.ndarray] = []
    valid_positions: list[int] = []

    for position, (_, record) in enumerate(frame.iterrows()):
        row_number = position + 2  # +1 for zero-index, +1 for the header line
        student_id = (
            str(record[id_column]) if id_column is not None
            and not pd.isna(record[id_column]) else None
        )

        values: list[float] = []
        error: str | None = None

        for key in registry.feature_keys:
            raw = record[mapping[key]]
            try:
                if pd.isna(raw):
                    raise ValueError("missing value")
                value = float(raw)
            except (TypeError, ValueError):
                error = f"Column '{mapping[key]}' is not a number ({raw!r})."
                break

            low, high = VALID_RANGES[key]
            if not (low <= value <= high):
                error = f"'{mapping[key]}' = {value:g} is outside the accepted range {low:g}-{high:g}."
                break

            values.append(value)

        if error:
            rows.append({"row": row_number, "student_id": student_id, "error": error})
            continue

        valid_positions.append(len(rows))
        valid_vectors.append(np.array(values, dtype=np.float64))
        rows.append({"row": row_number, "student_id": student_id})

    # One batched forward pass for every valid row.
    if valid_vectors:
        matrix = np.vstack(valid_vectors)
        scores = predict_many(matrix, model_key)

        # Per-row tree-spread intervals would mean thousands of per-estimator
        # passes; for batch work the held-out residual spread is used as a
        # constant uncertainty estimate instead.
        batch_std = registry.residual_std(model_key)

        for offset, position in enumerate(valid_positions):
            score = float(scores[offset])
            vector = valid_vectors[offset]
            risk = assess_risk(vector, score, batch_std, [])

            rows[position].update({
                "inputs": {
                    key: float(v) for key, v in zip(registry.feature_keys, vector)
                },
                "predicted_score": round(score, 2),
                "grade": grade_for(score)["grade"],
                "percentile": percentile_for(score),
                "risk_level": risk["level"],
            })

    return {
        "rows": rows,
        "summary": summarise(rows),
        "model_used": model_stamp(model_key),
        "generated_at": now_iso(),
    }


def summarise(rows: list[dict]) -> dict:
    scored = [r["predicted_score"] for r in rows if r.get("predicted_score") is not None]

    grade_distribution: dict[str, int] = {}
    for row in rows:
        grade = row.get("grade")
        if grade:
            grade_distribution[grade] = grade_distribution.get(grade, 0) + 1

    at_risk = sum(
        1 for r in rows
        if r.get("predicted_score") is not None and r["predicted_score"] < PASS_THRESHOLD
    )

    if scored:
        array = np.array(scored, dtype=np.float64)
        stats = {
            "mean_score": round(float(array.mean()), 2),
            "median_score": round(float(np.median(array)), 2),
            "min_score": round(float(array.min()), 2),
            "max_score": round(float(array.max()), 2),
            "std_score": round(float(array.std()), 2),
        }
    else:
        stats = {
            "mean_score": None, "median_score": None,
            "min_score": None, "max_score": None, "std_score": None,
        }

    return {
        "total_rows": len(rows),
        "succeeded": len(scored),
        "failed": len(rows) - len(scored),
        "grade_distribution": grade_distribution,
        "at_risk_count": at_risk,
        **stats,
    }


def score_profiles(profiles, model_key: str | None = None) -> dict:
    """Score a JSON array of profiles through the same summary pipeline."""
    frame = pd.DataFrame([
        {key: getattr(p, key) for key in registry.feature_keys} for p in profiles
    ])
    return score_frame(frame, model_key)


def template_csv() -> str:
    """A ready-to-fill CSV showing the expected headers and plausible rows."""
    header = "student_id,study_hours,attendance,participation"
    samples = [
        "S-001,18.5,92,7.4",
        "S-002,6.0,71,3.1",
        "S-003,24.0,98,9.0",
        "S-004,12.3,84,5.5",
        "S-005,2.5,58,1.8",
    ]
    return "\n".join([header, *samples]) + "\n"
