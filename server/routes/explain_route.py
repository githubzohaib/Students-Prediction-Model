"""Explainability endpoints: attribution, sensitivity, global importance."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from config.ml_model import registry
from helper.explain_helper import (
    global_importance,
    sensitivity_curves,
    shapley_attribution,
)
from helper.prediction_helper import to_vector
from schemas.prediction_schema import (
    AttributionResponse,
    ExplainRequest,
    ImportanceResponse,
    SensitivityRequest,
    SensitivityResponse,
)

router = APIRouter(prefix="/explain", tags=["Explainability"])


def _resolve_model(key: str | None) -> str:
    try:
        return registry.resolve_key(key)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model '{key}'. Available: {', '.join(registry.model_keys)}.",
        ) from None


@router.post("/attribution", response_model=AttributionResponse,
             summary="Exact Shapley attribution for one prediction")
def attribution(payload: ExplainRequest):
    model_key = _resolve_model(payload.model)
    return shapley_attribution(to_vector(payload), model_key)


@router.post("/sensitivity", response_model=SensitivityResponse,
             summary="Per-feature ICE curves for one student")
def sensitivity(payload: SensitivityRequest):
    model_key = _resolve_model(payload.model)
    return sensitivity_curves(to_vector(payload), model_key, payload.resolution)


@router.get("/importance", response_model=ImportanceResponse,
            summary="Global feature importance and per-feature signal audit")
def importance():
    return global_importance()
