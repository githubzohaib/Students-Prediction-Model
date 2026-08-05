"""What-if simulation endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from config.ml_model import registry
from helper.simulate_helper import compare_scenarios, goal_seek
from schemas.prediction_schema import (
    GoalSeekRequest,
    GoalSeekResponse,
    ScenarioRequest,
    ScenarioResponse,
)

router = APIRouter(prefix="/simulate", tags=["Simulation"])


def _resolve_model(key: str | None) -> str:
    try:
        return registry.resolve_key(key)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model '{key}'. Available: {', '.join(registry.model_keys)}.",
        ) from None


@router.post("/goal-seek", response_model=GoalSeekResponse,
             summary="Solve for the lever value that reaches a target score")
def solve_goal(payload: GoalSeekRequest):
    model_key = _resolve_model(payload.model)

    if payload.lever not in registry.feature_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown lever '{payload.lever}'. "
                   f"Available: {', '.join(registry.feature_keys)}.",
        )

    return goal_seek(payload, payload.target_score, payload.lever, model_key)


@router.post("/scenarios", response_model=ScenarioResponse,
             summary="Compare up to eight named student profiles")
def scenarios(payload: ScenarioRequest):
    model_key = _resolve_model(payload.model)
    return compare_scenarios(payload.scenarios, model_key)
