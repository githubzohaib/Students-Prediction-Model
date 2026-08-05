import {
  Download, FileSpreadsheet, FileText, Upload, X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { scoreCsv, templateCsvUrl } from "../api/predictionApi";
import { VerticalBars } from "../components/charts/BarChart";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Select,
  Skeleton, Stat,
} from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { exportBatchCsv, exportBatchPdf } from "../lib/export";
import { RISK_COLOR, cx, gradeColor, int, num } from "../lib/format";
import type { BatchRow } from "../types";

interface Props {
  modelKey?: string;
  setModelKey: (key: string) => void;
  modelOptions: { value: string; label: string }[];
}

type SortKey = "row" | "predicted_score" | "grade";

export function BatchTab({ modelKey, setModelKey, modelOptions }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("row");
  const [sortDesc, setSortDesc] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const task = useCallback(
    (upload: File, model?: string) => scoreCsv(upload, model),
    [],
  );
  const { data, error, loading, run, reset } = useAsync(task);

  const accept = (candidate: File | null | undefined) => {
    if (!candidate) return;
    setFile(candidate);
    reset();
    run(candidate, modelKey);
  };

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = onlyErrors ? data.rows.filter((row) => row.error) : [...data.rows];

    return rows.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "row") comparison = a.row - b.row;
      else if (sortKey === "predicted_score") {
        comparison = (a.predicted_score ?? -1) - (b.predicted_score ?? -1);
      } else {
        comparison = (a.grade ?? "Z").localeCompare(b.grade ?? "Z");
      }
      return sortDesc ? -comparison : comparison;
    });
  }, [data, sortKey, sortDesc, onlyErrors]);

  const gradeChart = useMemo(() => {
    if (!data) return [];
    return ["A", "B", "C", "D", "F"]
      .filter((grade) => data.summary.grade_distribution[grade])
      .map((grade) => ({
        key: grade,
        label: grade,
        value: data.summary.grade_distribution[grade] ?? 0,
        color: gradeColor(grade),
      }));
  }, [data]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((prev) => !prev);
    else {
      setSortKey(key);
      setSortDesc(key !== "row");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Batch roster scoring"
          subtitle="Upload a CSV and score every student in one pass. Rows that fail validation are reported individually rather than failing the file."
          action={
            <a
              href={templateCsvUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
            >
              <FileSpreadsheet size={13} aria-hidden />
              Template
            </a>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                accept(event.dataTransfer.files?.[0]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={cx(
                "flex cursor-pointer flex-col items-center justify-center gap-2",
                "rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
                dragging
                  ? "border-[var(--series-1)] bg-surface-2"
                  : "border-hairline hover:border-hairline-strong hover:bg-surface-2",
              )}
            >
              <Upload size={22} className="text-muted" aria-hidden />
              <p className="text-sm font-medium text-ink">
                {file ? file.name : "Drop a CSV here, or click to browse"}
              </p>
              <p className="text-center text-[11px] leading-relaxed text-muted">
                Needs columns for study hours, attendance and participation.
                Common header spellings are matched automatically. Max 5,000 rows.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => accept(event.target.files?.[0])}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Field label="Estimator" htmlFor="batch-model">
              <Select
                id="batch-model"
                value={modelKey ?? ""}
                onChange={(next) => {
                  setModelKey(next);
                  if (file) run(file, next);
                }}
                options={modelOptions}
              />
            </Field>

            {file && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  reset();
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X size={13} aria-hidden />
                Clear file
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorState
              message={error}
              onRetry={file ? () => run(file, modelKey) : undefined}
            />
          </div>
        )}
      </Card>

      {loading && <Skeleton className="h-64" />}

      {!file && !loading && !data && (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet size={28} />}
            title="No roster loaded"
            description="Upload a CSV to score a whole cohort at once, then export the results as CSV or a PDF report."
          />
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Rows" value={int(data.summary.total_rows)} />
            <Stat
              label="Scored"
              value={int(data.summary.succeeded)}
              hint={data.summary.failed ? `${data.summary.failed} failed` : "All rows valid"}
              tone={data.summary.failed ? undefined : "good"}
            />
            <Stat
              label="Mean score"
              value={num(data.summary.mean_score, 1)}
              hint={`σ ${num(data.summary.std_score, 1)}`}
            />
            <Stat
              label="Range"
              value={`${num(data.summary.min_score, 0)}–${num(data.summary.max_score, 0)}`}
              hint={`Median ${num(data.summary.median_score, 1)}`}
            />
            <Stat
              label="At risk"
              value={int(data.summary.at_risk_count)}
              hint="Predicted below 55"
              accent={data.summary.at_risk_count ? "var(--critical)" : undefined}
            />
          </div>

          {gradeChart.length > 0 && (
            <Card>
              <CardHeader
                title="Grade distribution"
                subtitle={`Scored with ${data.model_used.label}.`}
              />
              <VerticalBars
                data={gradeChart}
                height={200}
                yLabel="Students"
                xLabel="Grade"
                formatValue={(value) => int(value)}
                tableCaption="Number of students per predicted grade"
              />
            </Card>
          )}

          <Card>
            <CardHeader
              title="Results"
              subtitle={`${sortedRows.length} of ${data.rows.length} rows shown.`}
              action={
                <div className="flex flex-wrap gap-2">
                  {data.summary.failed > 0 && (
                    <Button
                      size="sm"
                      variant={onlyErrors ? "primary" : "secondary"}
                      onClick={() => setOnlyErrors((prev) => !prev)}
                    >
                      {onlyErrors ? "Show all" : `Errors (${data.summary.failed})`}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => exportBatchCsv(data)}>
                    <Download size={13} aria-hidden />
                    CSV
                  </Button>
                  <Button size="sm" onClick={() => exportBatchPdf(data)}>
                    <FileText size={13} aria-hidden />
                    PDF
                  </Button>
                </div>
              }
            />

            <div className="scroll-x max-h-[520px] overflow-y-auto">
              <table className="w-full min-w-[680px] text-xs">
                <caption className="sr-only">Per-student batch predictions</caption>
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <SortHeader label="Row" active={sortKey === "row"} desc={sortDesc}
                                onClick={() => toggleSort("row")} />
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">ID</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Study</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Attend</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Part.</th>
                    <SortHeader label="Score" active={sortKey === "predicted_score"} desc={sortDesc}
                                onClick={() => toggleSort("predicted_score")} />
                    <SortHeader label="Grade" active={sortKey === "grade"} desc={sortDesc}
                                onClick={() => toggleSort("grade")} />
                    <th scope="col" className="border-b border-hairline py-2 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <ResultRow key={row.row} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SortHeader({
  label, active, desc, onClick,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}) {
  return (
    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">
      <button
        onClick={onClick}
        className={cx(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors",
          active ? "text-ink" : "hover:text-ink-2",
        )}
        aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      >
        {label}
        <span aria-hidden className="text-[9px]">
          {active ? (desc ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );
}

function ResultRow({ row }: { row: BatchRow }) {
  if (row.error) {
    return (
      <tr>
        <td className="border-b border-hairline py-2 pr-3 text-ink-2">{row.row}</td>
        <td className="border-b border-hairline py-2 pr-3 text-ink-2">
          {row.student_id ?? "—"}
        </td>
        <td
          colSpan={6}
          className="border-b border-hairline py-2 text-[11px]"
          style={{ color: "var(--critical)" }}
        >
          {row.error}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">{row.row}</td>
      <td className="border-b border-hairline py-2 pr-3 text-ink">
        {row.student_id ?? "—"}
      </td>
      <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
        {num(row.inputs?.study_hours, 1)}
      </td>
      <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
        {num(row.inputs?.attendance, 1)}
      </td>
      <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
        {num(row.inputs?.participation, 1)}
      </td>
      <td className="tabular border-b border-hairline py-2 pr-3 font-medium text-ink">
        {num(row.predicted_score, 1)}
      </td>
      <td className="border-b border-hairline py-2 pr-3">
        {row.grade && <Badge color={gradeColor(row.grade)}>{row.grade}</Badge>}
      </td>
      <td className="border-b border-hairline py-2">
        {row.risk_level && (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: RISK_COLOR[row.risk_level] }}
            />
            {row.risk_level}
          </span>
        )}
      </td>
    </tr>
  );
}
