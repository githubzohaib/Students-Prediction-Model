from pydantic import BaseModel

class PredictionRequest(BaseModel):
    study_hours: float
    attendance: float
    participation: float


class PredictionResponse(BaseModel):
    predicted_score: float