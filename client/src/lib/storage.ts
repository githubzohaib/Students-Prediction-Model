import type { HistoryEntry, PredictionResponse } from "../types";

const HISTORY_KEY = "spm.history.v2";
const MAX_ENTRIES = 100;

function safeParse(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(HISTORY_KEY));
}

function persist(entries: HistoryEntry[]): HistoryEntry[] {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or storage disabled -- history is a convenience, not
    // a requirement, so a failure here must not break the prediction flow.
  }
  return trimmed;
}

export function saveToHistory(
  prediction: PredictionResponse,
  label?: string,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    label: label?.trim() || `Student ${new Date().toLocaleTimeString()}`,
    inputs: prediction.inputs,
    predicted_score: prediction.predicted_score,
    grade: prediction.grade,
    percentile: prediction.percentile,
    risk_level: prediction.risk.level,
    model_key: prediction.model_used.key,
  };
  return persist([entry, ...loadHistory()]);
}

export function removeFromHistory(id: string): HistoryEntry[] {
  return persist(loadHistory().filter((entry) => entry.id !== id));
}

export function clearHistory(): HistoryEntry[] {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
  return [];
}
