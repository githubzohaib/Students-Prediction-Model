import type { RiskLevel } from "../types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

export function signed(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** 1 -> 1st, 2 -> 2nd, 93 -> 93rd */
export function ordinal(value: number): string {
  const rounded = Math.round(value);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1: return `${rounded}st`;
    case 2: return `${rounded}nd`;
    case 3: return `${rounded}rd`;
    default: return `${rounded}th`;
  }
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function unitSuffix(unit: string): string {
  if (unit === "%") return "%";
  if (unit === "/ 10") return "";
  return ` ${unit}`;
}

/** Status colours are fixed and always ship alongside a text label. */
export const RISK_COLOR: Record<RiskLevel, string> = {
  low: "var(--good)",
  moderate: "var(--warning)",
  elevated: "var(--serious)",
  high: "var(--critical)",
};

export const RISK_ICON: Record<RiskLevel, string> = {
  low: "✓",
  moderate: "!",
  elevated: "▲",
  high: "✕",
};

export function gradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A": return "var(--grade-a)";
    case "B": return "var(--grade-b)";
    case "C": return "var(--grade-c)";
    case "D": return "var(--grade-d)";
    default: return "var(--grade-f)";
  }
}

/** Fixed categorical assignment: colour follows the feature, never its rank. */
export const FEATURE_COLOR: Record<string, string> = {
  study_hours: "var(--series-1)",
  attendance: "var(--series-2)",
  participation: "var(--series-3)",
};
