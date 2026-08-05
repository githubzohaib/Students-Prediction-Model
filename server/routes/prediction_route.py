"""Single and batch scoring endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse

from config.ml_model import registry
from helper import batch_helper
from helper.prediction_helper import predict_profile
from schemas.prediction_schema import (
    BatchJsonRequest,
    BatchResponse,
    PredictionRequest,
    PredictionResponse,
)

router = APIRouter(prefix="/prediction", tags=["Prediction"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


def _resolve_model(key: str | None) -> str:
    try:
        return registry.resolve_key(key)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model '{key}'. Available: {', '.join(registry.model_keys)}.",
        ) from None


@router.post("/predict", response_model=PredictionResponse,
             summary="Score a single student")
def predict(payload: PredictionRequest):
    model_key = _resolve_model(payload.model)
    return predict_profile(
        payload,
        model_key=model_key,
        include_recommendations=payload.include_recommendations,
    )


@router.post("/batch", response_model=BatchResponse,
             summary="Score an array of students")
def batch_json(payload: BatchJsonRequest):
    model_key = _resolve_model(payload.model)
    try:
        return batch_helper.score_profiles(payload.students, model_key)
    except batch_helper.BatchParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(exc)) from exc


@router.post("/batch/csv", response_model=BatchResponse,
             summary="Score a roster uploaded as CSV")
async def batch_csv(
    file: UploadFile = File(..., description="CSV with study_hours, attendance, participation."),
    model: str | None = Query(None, description="Model key; defaults to champion."),
):
    model_key = _resolve_model(model)

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit.",
        )

    try:
        frame = batch_helper.parse_csv(content)
        return batch_helper.score_frame(frame, model_key)
    except batch_helper.BatchParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=str(exc)) from exc


@router.get("/template.csv", response_class=PlainTextResponse,
            summary="Download a CSV template for batch scoring")
def download_template():
    return PlainTextResponse(
        batch_helper.template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="student_roster_template.csv"'},
    )
