import { ArrowUpRight, Download, History as HistoryIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { VerticalBars } from "../components/charts/BarChart";
import {
  Badge, Button, Card, CardHeader, EmptyState, Stat,
} from "../components/ui";
import { downloadCsv } from "../lib/export";
import {
  RISK_COLOR, formatTimestamp, gradeColor, num, ordinal,
} from "../lib/format";
import { clearHistory, loadHistory, removeFromHistory } from "../lib/storage";
import type { HistoryEntry } from "../types";

export function HistoryTab({
  onLoad,
}: {
  onLoad: (entry: HistoryEntry) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());

  const stats = useMemo(() => {
    if (!entries.length) return null;
    const scores = entries.map((entry) => entry.predicted_score);
    return {
      count: entries.length,
      mean: scores.reduce((total, score) => total + score, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      atRisk: entries.filter((entry) => entry.predicted_score < 55).length,
    };
  }, [entries]);

  const exportCsv = () => {
    downloadCsv(
      `prediction-history-${Date.now()}.csv`,
      ["saved_at", "label", "study_hours", "attendance", "participation",
       "predicted_score", "grade", "percentile", "risk_level", "model"],
      entries.map((entry) => [
        entry.savedAt, entry.label,
        entry.inputs.study_hours, entry.inputs.attendance, entry.inputs.participation,
        entry.predicted_score, entry.grade, entry.percentile, entry.risk_level,
        entry.model_key,
      ]),
    );
  };

  if (!entries.length) {
    return (
      <Card>
        <EmptyState
          icon={<HistoryIcon size={28} />}
          title="No saved predictions"
          description="Predictions you save from the Predict tab appear here. They are stored only in this browser — nothing is sent anywhere."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Saved" value={String(stats.count)} hint="On this device" />
          <Stat label="Mean score" value={num(stats.mean, 1)} />
          <Stat
            label="Range"
            value={`${num(stats.min, 0)}–${num(stats.max, 0)}`}
          />
          <Stat
            label="At risk"
            value={String(stats.atRisk)}
            hint="Predicted below 55"
            accent={stats.atRisk ? "var(--critical)" : undefined}
          />
        </div>
      )}

      {entries.length > 1 && (
        <Card>
          <CardHeader
            title="Saved predictions"
            subtitle="Most recent first. Bar colour encodes the grade band."
          />
          <VerticalBars
            data={[...entries].reverse().map((entry) => ({
              key: entry.id,
              label: entry.label.slice(0, 14),
              value: entry.predicted_score,
              color: gradeColor(entry.grade),
              note: `Grade ${entry.grade} · ${formatTimestamp(entry.savedAt)}`,
            }))}
            height={220}
            yLabel="Predicted score"
            formatValue={(value) => num(value, 0)}
            tableCaption="Saved prediction scores over time"
            rotateLabels={entries.length > 5}
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Records"
          subtitle={`${entries.length} saved locally.`}
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={exportCsv}>
                <Download size={13} aria-hidden />
                CSV
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setEntries(clearHistory())}
              >
                <Trash2 size={13} aria-hidden />
                Clear all
              </Button>
            </div>
          }
        />

        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-xs">
            <caption className="sr-only">Saved prediction history</caption>
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Label</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Saved</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Study</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Attend</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Part.</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Score</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Grade</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Pct</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Risk</th>
                <th scope="col" className="border-b border-hairline py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="border-b border-hairline py-2 pr-3 font-medium text-ink">
                    {entry.label}
                  </td>
                  <td className="border-b border-hairline py-2 pr-3 text-[11px] text-muted">
                    {formatTimestamp(entry.savedAt)}
                  </td>
                  <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                    {num(entry.inputs.study_hours, 1)}
                  </td>
                  <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                    {num(entry.inputs.attendance, 1)}
                  </td>
                  <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                    {num(entry.inputs.participation, 1)}
                  </td>
                  <td className="tabular border-b border-hairline py-2 pr-3 font-medium text-ink">
                    {num(entry.predicted_score, 1)}
                  </td>
                  <td className="border-b border-hairline py-2 pr-3">
                    <Badge color={gradeColor(entry.grade)}>{entry.grade}</Badge>
                  </td>
                  <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                    {ordinal(entry.percentile)}
                  </td>
                  <td className="border-b border-hairline py-2 pr-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: RISK_COLOR[entry.risk_level] }}
                      />
                      {entry.risk_level}
                    </span>
                  </td>
                  <td className="border-b border-hairline py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onLoad(entry)}
                        title="Load into the Predict tab"
                        aria-label={`Load ${entry.label} into the Predict tab`}
                        className="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <ArrowUpRight size={13} />
                      </button>
                      <button
                        onClick={() => setEntries(removeFromHistory(entry.id))}
                        title="Delete"
                        aria-label={`Delete ${entry.label}`}
                        className="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
