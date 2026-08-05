import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { BatchResponse, PredictionResponse } from "../types";
import { formatTimestamp, num } from "./format";

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** RFC 4180 quoting so commas and quotes inside values survive the round trip. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  // The BOM keeps Excel from mangling UTF-8 on open.
  download(new Blob(["﻿" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportBatchCsv(batch: BatchResponse): void {
  const headers = [
    "row", "student_id", "study_hours", "attendance", "participation",
    "predicted_score", "grade", "percentile", "risk_level", "error",
  ];

  const rows = batch.rows.map((row) => [
    row.row,
    row.student_id ?? "",
    row.inputs?.study_hours ?? "",
    row.inputs?.attendance ?? "",
    row.inputs?.participation ?? "",
    row.predicted_score ?? "",
    row.grade ?? "",
    row.percentile ?? "",
    row.risk_level ?? "",
    row.error ?? "",
  ]);

  downloadCsv(`predictions-${Date.now()}.csv`, headers, rows);
}

function pdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  doc.setFontSize(18);
  doc.setTextColor(11, 11, 11);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 118);
  doc.text(subtitle, 14, 27);

  doc.setDrawColor(225, 224, 217);
  doc.line(14, 31, 196, 31);

  return 38;
}

export function exportPredictionPdf(prediction: PredictionResponse, label?: string): void {
  const doc = new jsPDF();
  let y = pdfHeader(
    doc,
    "Student Performance Report",
    `Generated ${formatTimestamp(prediction.generated_at)} · ${prediction.model_used.label}`,
  );

  doc.setFontSize(12);
  doc.setTextColor(11, 11, 11);
  doc.text(label?.trim() || "Prediction summary", 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Predicted score", `${num(prediction.predicted_score, 2)} / 100`],
      ["Grade", prediction.grade],
      [
        `${Math.round(prediction.confidence.level * 100)}% interval`,
        `${num(prediction.confidence.lower, 1)} – ${num(prediction.confidence.upper, 1)}`,
      ],
      ["Cohort percentile", `${num(prediction.percentile, 1)}`],
      ["Cohort mean", num(prediction.cohort_mean, 1)],
      ["Risk level", `${prediction.risk.label} (${num(prediction.risk.score, 1)}/100)`],
      ["Model R²", num(prediction.model_used.r2, 4)],
      ["Model MAE", num(prediction.model_used.mae, 3)],
    ],
    theme: "striped",
    headStyles: { fillColor: [42, 120, 214] },
    styles: { fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Inputs", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Feature", "Value"]],
    body: [
      ["Weekly self-study hours", num(prediction.inputs.study_hours, 1)],
      ["Attendance", `${num(prediction.inputs.attendance, 1)}%`],
      ["Class participation", `${num(prediction.inputs.participation, 1)} / 10`],
    ],
    theme: "striped",
    headStyles: { fillColor: [42, 120, 214] },
    styles: { fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (prediction.recommendations.length) {
    doc.setFontSize(12);
    doc.text("Improvement levers", 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [["Lever", "Change", "Projected gain", "Effective"]],
      body: prediction.recommendations.map((rec) => [
        rec.label,
        `+${num(rec.delta, 1)}`,
        `${num(rec.projected_gain, 2)} pts`,
        rec.effective ? "Yes" : "No measurable effect",
      ]),
      theme: "striped",
      headStyles: { fillColor: [42, 120, 214] },
      styles: { fontSize: 9 },
    });
  }

  doc.save(`prediction-report-${Date.now()}.pdf`);
}

export function exportBatchPdf(batch: BatchResponse): void {
  const doc = new jsPDF();
  const { summary } = batch;

  let y = pdfHeader(
    doc,
    "Cohort Prediction Report",
    `Generated ${formatTimestamp(batch.generated_at)} · ${batch.model_used.label}`,
  );

  autoTable(doc, {
    startY: y,
    head: [["Rows", "Scored", "Failed", "Mean", "Median", "Min", "Max", "At risk"]],
    body: [[
      summary.total_rows, summary.succeeded, summary.failed,
      num(summary.mean_score), num(summary.median_score),
      num(summary.min_score), num(summary.max_score), summary.at_risk_count,
    ]],
    theme: "grid",
    headStyles: { fillColor: [42, 120, 214] },
    styles: { fontSize: 9 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: y,
    head: [["Row", "ID", "Study", "Attend", "Part.", "Score", "Grade", "Risk"]],
    body: batch.rows.map((row) => [
      row.row,
      row.student_id ?? "—",
      row.inputs ? num(row.inputs.study_hours) : "—",
      row.inputs ? num(row.inputs.attendance) : "—",
      row.inputs ? num(row.inputs.participation) : "—",
      row.predicted_score !== null ? num(row.predicted_score, 2) : "error",
      row.grade ?? "—",
      row.risk_level ?? "—",
    ]),
    theme: "striped",
    headStyles: { fillColor: [42, 120, 214] },
    styles: { fontSize: 8 },
  });

  doc.save(`cohort-report-${Date.now()}.pdf`);
}
