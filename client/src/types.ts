/** Shared contracts mirroring the FastAPI response models. */

export type FeatureKey = "study_hours" | "attendance" | "participation";

export interface StudentProfile {
  study_hours: number;
  attendance: number;
  participation: number;
}

export interface FeatureSchema {
  key: FeatureKey;
  label: string;
  short: string;
  unit: string;
  step: number;
  description: string;
  min: number;
  max: number;
  p1: number;
  p25: number;
  median: number;
  p75: number;
  p99: number;
  mean: number;
  std: number;
}

export interface GradeBand {
  grade: string;
  min: number;
  max: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
  std: number;
  method: "tree-ensemble-spread" | "residual-normal";
}

export type RiskLevel = "low" | "moderate" | "elevated" | "high";
export type Severity = "low" | "medium" | "high";

export interface RiskFactor {
  label: string;
  detail: string;
  severity: Severity;
}

export interface RiskAssessment {
  level: RiskLevel;
  label: string;
  score: number;
  factors: RiskFactor[];
}

export interface Recommendation {
  feature: FeatureKey;
  label: string;
  action: string;
  delta: number;
  projected_gain: number;
  projected_score: number;
  effort: "low" | "medium" | "high";
  effective: boolean;
}

export interface ModelStamp {
  key: string;
  label: string;
  r2: number;
  mae: number;
}

export interface PredictionResponse {
  predicted_score: number;
  grade: string;
  grade_band: GradeBand;
  confidence: ConfidenceInterval;
  risk: RiskAssessment;
  percentile: number;
  cohort_mean: number;
  delta_vs_cohort: number;
  recommendations: Recommendation[];
  warnings: string[];
  model_used: ModelStamp;
  inputs: StudentProfile;
  generated_at: string;
}

export interface FeatureContribution {
  feature: FeatureKey;
  label: string;
  value: number;
  contribution: number;
  share: number;
  direction: "positive" | "negative" | "neutral";
}

export interface AttributionResponse {
  baseline: number;
  prediction: number;
  contributions: FeatureContribution[];
  residual: number;
  method: string;
  background_size: number;
  model_used: ModelStamp;
}

export interface SensitivityCurve {
  feature: FeatureKey;
  label: string;
  unit: string;
  current_value: number;
  current_prediction: number;
  min_y: number;
  max_y: number;
  swing: number;
  points: { x: number; y: number }[];
}

export interface SensitivityResponse {
  curves: SensitivityCurve[];
  prediction: number;
  model_used: ModelStamp;
}

export interface SignalAuditEntry {
  feature: FeatureKey;
  label: string;
  pearson_r: number;
  spearman_r: number;
  mutual_information: number;
  permutation_r2_drop: number;
  permutation_r2_drop_std: number;
  verdict: "predictive" | "no-signal";
}

export interface ImportanceEntry {
  feature: FeatureKey;
  label: string;
  permutation_importance: number;
  permutation_share: number;
  impurity_importance: number | null;
  std: number;
}

export interface ImportanceResponse {
  importance: ImportanceEntry[];
  signal_audit: SignalAuditEntry[];
  champion: string;
}

export interface GoalSeekResponse {
  feasible: boolean;
  lever: FeatureKey;
  lever_label: string;
  unit: string;
  current_value: number;
  required_value: number | null;
  delta: number | null;
  target_score: number;
  current_score: number;
  achieved_score: number;
  max_achievable_score: number;
  message: string;
}

export interface NamedScenario extends StudentProfile {
  name: string;
}

export interface ScenarioResult {
  name: string;
  inputs: StudentProfile;
  predicted_score: number;
  grade: string;
  percentile: number;
  confidence: ConfidenceInterval;
  delta_vs_baseline: number;
}

export interface ScenarioResponse {
  results: ScenarioResult[];
  best: string;
  worst: string;
  spread: number;
  model_used: ModelStamp;
}

export interface BatchRow {
  row: number;
  student_id: string | null;
  inputs: StudentProfile | null;
  predicted_score: number | null;
  grade: string | null;
  percentile: number | null;
  risk_level: RiskLevel | null;
  error: string | null;
}

export interface BatchSummary {
  total_rows: number;
  succeeded: number;
  failed: number;
  mean_score: number | null;
  median_score: number | null;
  min_score: number | null;
  max_score: number | null;
  std_score: number | null;
  grade_distribution: Record<string, number>;
  at_risk_count: number;
}

export interface BatchResponse {
  rows: BatchRow[];
  summary: BatchSummary;
  model_used: ModelStamp;
  generated_at: string;
}

export interface ModelMetrics {
  r2: number;
  mae: number;
  rmse: number;
  mape: number;
  residual_std: number;
  max_error: number;
  within_5_points: number;
  within_10_points: number;
  cv_r2_mean: number;
  cv_r2_std: number;
  cv_folds: number;
  cv_sample: number;
  train_seconds: number;
}

export interface ModelCatalogEntry {
  key: string;
  label: string;
  family: string;
  notes: string;
  is_champion: boolean;
  supports_tree_interval: boolean;
  metrics: ModelMetrics;
  hyperparameters: Record<string, string | number | boolean>;
}

export interface DatasetInfo {
  source: string;
  rows: number;
  train_rows: number;
  test_rows: number;
  test_size: number;
  random_state: number;
}

export interface ModelCatalogResponse {
  models: ModelCatalogEntry[];
  champion: string;
  dataset: DatasetInfo;
  environment: Record<string, string>;
  generated_at: string;
  training_seconds: number;
}

export interface Histogram {
  edges: number[];
  centers: number[];
  counts: number[];
}

export interface DecilePoint {
  bin_label: string;
  bin_mid: number;
  mean_score: number;
  p25: number;
  p75: number;
  count: number;
}

export interface AnalyticsOverview {
  analytics: {
    histograms: Record<FeatureKey, Histogram>;
    target_histogram: Histogram;
    correlation: { labels: string[]; keys: string[]; matrix: number[][] };
    decile_curves: Record<FeatureKey, DecilePoint[]>;
    grade_distribution: { grade: string; count: number; share: number }[];
    score_percentiles: { p: number; score: number }[];
    target_summary: {
      mean: number;
      median: number;
      std: number;
      min: number;
      max: number;
      ceiling_share: number;
    };
  };
  features: FeatureSchema[];
  grades: { grade: string; min: number; max: number; count: number; share: number }[];
  target: { key: string; label: string; min: number; max: number; mean: number; std: number };
  dataset: DatasetInfo;
  signal_audit: SignalAuditEntry[];
}

export interface HealthResponse {
  status: string;
  version: string;
  champion: string;
  models: string[];
  dataset_rows: number;
  trained_at: string;
}

/** A prediction the user chose to keep, persisted in localStorage. */
export interface HistoryEntry {
  id: string;
  savedAt: string;
  label: string;
  inputs: StudentProfile;
  predicted_score: number;
  grade: string;
  percentile: number;
  risk_level: RiskLevel;
  model_key: string;
}
