from fastapi import APIRouter

from schemas.prediction_schema import (
    PredictionRequest,
    PredictionResponse
)

from helper.prediction_helper import (
    predict_score
)

router = APIRouter(
    prefix="/prediction",
    tags=["Prediction"]
)

@router.post(
    "/predict",
    response_model=PredictionResponse
)
def predict(
    data: PredictionRequest
):

    score = predict_score(
        data.study_hours,
        data.attendance,
        data.participation
    )

    return {
        "predicted_score": round(score, 2)
    }