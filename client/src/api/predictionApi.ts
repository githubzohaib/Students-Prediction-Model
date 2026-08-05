import { api, baseURL } from "./client";
import type {
  AnalyticsOverview,
  AttributionResponse,
  BatchResponse,
  FeatureSchema,
  GoalSeekResponse,
  HealthResponse,
  ImportanceResponse,
  ModelCatalogResponse,
  NamedScenario,
  PredictionResponse,
  ScenarioResponse,
  SensitivityResponse,
  StudentProfile,
} from "../types";

export async function getHealth() {
  const { data } = await api.get<HealthResponse>("/health");
  return data;
}

export async function predictScore(
  profile: StudentProfile,
  model?: string,
  includeRecommendations = true,
) {
  const { data } = await api.post<PredictionResponse>("/prediction/predict", {
    ...profile,
    model,
    include_recommendations: includeRecommendations,
  });
  return data;
}

export async function getAttribution(profile: StudentProfile, model?: string) {
  const { data } = await api.post<AttributionResponse>("/explain/attribution", {
    ...profile,
    model,
  });
  return data;
}

export async function getSensitivity(
  profile: StudentProfile,
  model?: string,
  resolution = 40,
) {
  const { data } = await api.post<SensitivityResponse>("/explain/sensitivity", {
    ...profile,
    model,
    resolution,
  });
  return data;
}

export async function getImportance() {
  const { data } = await api.get<ImportanceResponse>("/explain/importance");
  return data;
}

export async function goalSeek(
  profile: StudentProfile,
  targetScore: number,
  lever: string,
  model?: string,
) {
  const { data } = await api.post<GoalSeekResponse>("/simulate/goal-seek", {
    ...profile,
    target_score: targetScore,
    lever,
    model,
  });
  return data;
}

export async function compareScenarios(scenarios: NamedScenario[], model?: string) {
  const { data } = await api.post<ScenarioResponse>("/simulate/scenarios", {
    scenarios,
    model,
  });
  return data;
}

export async function scoreCsv(file: File, model?: string) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post<BatchResponse>("/prediction/batch/csv", form, {
    params: model ? { model } : undefined,
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
  });
  return data;
}

export async function getModelCatalog() {
  const { data } = await api.get<ModelCatalogResponse>("/model/catalog");
  return data;
}

export async function getFeatureSchema() {
  const { data } = await api.get<FeatureSchema[]>("/model/features");
  return data;
}

export async function getAnalytics() {
  const { data } = await api.get<AnalyticsOverview>("/analytics/overview");
  return data;
}

export const templateCsvUrl = `${baseURL}/prediction/template.csv`;
