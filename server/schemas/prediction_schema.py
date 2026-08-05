"""Request/response contracts for the prediction API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Bounds mirror the observed training ranges; requests outside them are still
# accepted but the response carries an extrapolation warning.
STUDY_HOURS = Field(..., ge=0, le=80, description="Weekly self-study hours.")
ATTENDANCE = Field(..., ge=0, le=100, description="Attendance percentage.")
PARTICIPATION = Field(..., ge=0, le=10, description="Class participation rating.")


class StudentProfile(BaseModel):
    """The three inputs the model consumes."""

    model_config = ConfigDict(json_schema_extra={
        "example": {"study_hours": 18.5, "attendance": 92.0, "participation": 7.4}
    })

    study_hours: float = STUDY_HOURS
    attendance: float = ATTENDANCE
    participation: float = PARTICIPATION


class PredictionRequest(StudentProfile):
    model: str | None = Field(
        None, description="Model key to use. Defaults to the champion model."
    )
    include_recommendations: bool = Field(
        True, description="Compute model-driven improvement levers."
    )


class GradeBand(BaseModel):
    grade: str
    min: float
    max: float


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float
    level: float = Field(..., description="Interval coverage, e.g. 0.95.")
    std: float
    method: Literal["tree-ensemble-spread", "residual-normal"]


class RiskFactor(BaseModel):
    label: str
    detail: str
    severity: Literal["low", "medium", "high"]


class RiskAssessment(BaseModel):
    level: Literal["low", "moderate", "elevated", "high"]
    label: str
    score: float = Field(..., description="0-100, higher means more at risk.")
    factors: list[RiskFactor]


class Recommendation(BaseModel):
    feature: str
    label: str
    action: str
    delta: float = Field(..., description="Change applied to the feature.")
    projected_gain: float = Field(..., description="Predicted score improvement.")
    projected_score: float
    effort: Literal["low", "medium", "high"]
    effective: bool = Field(
        ..., description="False when the model shows this lever has no measurable effect."
    )


class ModelStamp(BaseModel):
    key: str
    label: str
    r2: float
    mae: float


class PredictionResponse(BaseModel):
    predicted_score: float
    grade: str
    grade_band: GradeBand
    confidence: ConfidenceInterval
    risk: RiskAssessment
    percentile: float = Field(..., description="Cohort rank of the predicted score.")
    cohort_mean: float
    delta_vs_cohort: float
    recommendations: list[Recommendation]
    warnings: list[str]
    model_used: ModelStamp
    inputs: StudentProfile
    generated_at: str


# ---------------------------------------------------------------------------
# Explainability
# ---------------------------------------------------------------------------

class ExplainRequest(StudentProfile):
    model: str | None = None


class FeatureContribution(BaseModel):
    feature: str
    label: str
    value: float
    contribution: float = Field(..., description="Exact Shapley value, in score points.")
    share: float = Field(..., description="Share of total absolute attribution.")
    direction: Literal["positive", "negative", "neutral"]


class AttributionResponse(BaseModel):
    baseline: float = Field(..., description="Mean model output over the background sample.")
    prediction: float
    contributions: list[FeatureContribution]
    residual: float = Field(
        ..., description="prediction - baseline - sum(contributions); ~0 by construction."
    )
    method: str
    background_size: int
    model_used: ModelStamp


class SensitivityRequest(StudentProfile):
    model: str | None = None
    resolution: int = Field(40, ge=8, le=120, description="Grid points per feature.")


class CurvePoint(BaseModel):
    x: float
    y: float


class SensitivityCurve(BaseModel):
    feature: str
    label: str
    unit: str
    current_value: float
    current_prediction: float
    min_y: float
    max_y: float
    swing: float = Field(..., description="max_y - min_y across the sweep.")
    points: list[CurvePoint]


class SensitivityResponse(BaseModel):
    curves: list[SensitivityCurve]
    prediction: float
    model_used: ModelStamp


class SignalAuditEntry(BaseModel):
    feature: str
    label: str
    pearson_r: float
    spearman_r: float
    mutual_information: float
    permutation_r2_drop: float
    permutation_r2_drop_std: float
    verdict: Literal["predictive", "no-signal"]


class ImportanceEntry(BaseModel):
    feature: str
    label: str
    permutation_importance: float
    permutation_share: float
    impurity_importance: float | None
    std: float


class ImportanceResponse(BaseModel):
    importance: list[ImportanceEntry]
    signal_audit: list[SignalAuditEntry]
    champion: str


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

class GoalSeekRequest(StudentProfile):
    target_score: float = Field(..., ge=0, le=100, description="Score to reach.")
    lever: str = Field(..., description="Feature key to solve for.")
    model: str | None = None


class GoalSeekResponse(BaseModel):
    feasible: bool
    lever: str
    lever_label: str
    unit: str
    current_value: float
    required_value: float | None
    delta: float | None
    target_score: float
    current_score: float
    achieved_score: float
    max_achievable_score: float
    message: str


class NamedScenario(StudentProfile):
    name: str = Field(..., max_length=60)


class ScenarioRequest(BaseModel):
    scenarios: list[NamedScenario] = Field(..., min_length=1, max_length=8)
    model: str | None = None


class ScenarioResult(BaseModel):
    name: str
    inputs: StudentProfile
    predicted_score: float
    grade: str
    percentile: float
    confidence: ConfidenceInterval
    delta_vs_baseline: float


class ScenarioResponse(BaseModel):
    results: list[ScenarioResult]
    best: str
    worst: str
    spread: float
    model_used: ModelStamp


# ---------------------------------------------------------------------------
# Batch
# ---------------------------------------------------------------------------

class BatchRow(BaseModel):
    row: int
    student_id: str | None = None
    inputs: StudentProfile | None = None
    predicted_score: float | None = None
    grade: str | None = None
    percentile: float | None = None
    risk_level: str | None = None
    error: str | None = None


class BatchSummary(BaseModel):
    total_rows: int
    succeeded: int
    failed: int
    mean_score: float | None
    median_score: float | None
    min_score: float | None
    max_score: float | None
    std_score: float | None
    grade_distribution: dict[str, int]
    at_risk_count: int


class BatchResponse(BaseModel):
    rows: list[BatchRow]
    summary: BatchSummary
    model_used: ModelStamp
    generated_at: str


class BatchJsonRequest(BaseModel):
    students: list[StudentProfile] = Field(..., min_length=1, max_length=5000)
    model: str | None = None


# ---------------------------------------------------------------------------
# Catalog / analytics
# ---------------------------------------------------------------------------

class ModelCatalogEntry(BaseModel):
    key: str
    label: str
    family: str
    notes: str
    is_champion: bool
    supports_tree_interval: bool
    metrics: dict[str, float | int]
    hyperparameters: dict[str, object]


class ModelCatalogResponse(BaseModel):
    models: list[ModelCatalogEntry]
    champion: str
    dataset: dict
    environment: dict
    generated_at: str
    training_seconds: float


class FeatureSchemaEntry(BaseModel):
    key: str
    label: str
    short: str
    unit: str
    step: float
    description: str
    min: float
    max: float
    p1: float
    p25: float
    median: float
    p75: float
    p99: float
    mean: float
    std: float
