import { useCallback, useState } from "react";

import { getAnalytics } from "../api/predictionApi";
import { VerticalBars } from "../components/charts/BarChart";
import { CorrelationHeatmap } from "../components/charts/Heatmap";
import { LineChart } from "../components/charts/LineChart";
import {
  Card, CardHeader, ErrorState, Field, Legend, Select, Skeleton, Stat,
} from "../components/ui";
import { useFetchOnMount } from "../hooks/useAsync";
import { FEATURE_COLOR, gradeColor, int, num, pct, unitSuffix } from "../lib/format";
import type { FeatureKey } from "../types";

export function AnalyticsTab() {
  const task = useCallback(() => getAnalytics(), []);
  const { data, error, loading, retry } = useFetchOnMount(task);
  const [feature, setFeature] = useState<FeatureKey>("study_hours");

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
    );
  }

  const { analytics, features, dataset, target } = data;
  const activeFeature = features.find((f) => f.key === feature)!;
  const histogram = analytics.histograms[feature];
  const decile = analytics.decile_curves[feature];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Training records" value={int(dataset.rows)} hint={dataset.source} />
        <Stat
          label="Mean score"
          value={num(analytics.target_summary.mean, 1)}
          hint={`σ ${num(analytics.target_summary.std, 1)}`}
        />
        <Stat
          label="Median score"
          value={num(analytics.target_summary.median, 1)}
          hint={`Range ${num(analytics.target_summary.min, 0)}–${num(analytics.target_summary.max, 0)}`}
        />
        <Stat
          label="At the ceiling"
          value={pct(analytics.target_summary.ceiling_share, 1)}
          hint={`Scores at exactly ${num(target.max, 0)}`}
          accent="var(--warning)"
        />
        <Stat
          label="Test split"
          value={int(dataset.test_rows)}
          hint={`${pct(dataset.test_size, 0)} held out`}
        />
      </div>

      {analytics.target_summary.ceiling_share > 0.05 && (
        <Card>
          <p className="text-xs leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Censored target.</span>{" "}
            {pct(analytics.target_summary.ceiling_share, 1)} of records sit at exactly{" "}
            {num(target.max, 0)} — the score is capped, so the model cannot
            distinguish between students who would otherwise have scored above it.
            This compresses the top of every response curve and caps achievable R².
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------------------------------- Score distribution */}
        <Card>
          <CardHeader
            title="Final score distribution"
            subtitle={`All ${int(dataset.rows)} training records.`}
          />
          <VerticalBars
            data={analytics.target_histogram.centers.map((center, index) => ({
              key: String(center),
              label: num(center, 0),
              value: analytics.target_histogram.counts[index],
            }))}
            height={230}
            yLabel="Students"
            xLabel="Final score"
            formatValue={(value) => int(value)}
            tableCaption="Distribution of final scores"
          />
        </Card>

        {/* ---------------------------------------- Grade distribution */}
        <Card>
          <CardHeader
            title="Grade distribution"
            subtitle="Bands recovered empirically from the dataset, not hard-coded."
          />
          <VerticalBars
            data={analytics.grade_distribution.map((entry) => ({
              key: entry.grade,
              label: entry.grade,
              value: entry.count,
              color: gradeColor(entry.grade),
              note: `${pct(entry.share, 1)} of the cohort`,
            }))}
            height={230}
            yLabel="Students"
            xLabel="Grade"
            formatValue={(value) => int(value)}
            tableCaption="Number of students per grade band"
          />
          <ul className="tabular mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
            {data.grades.map((band) => (
              <li key={band.grade}>
                <span className="font-medium text-ink">{band.grade}</span>{" "}
                {num(band.min, 0)}–{num(band.max, 0)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---------------------------------------- Feature explorer */}
      <Card>
        <CardHeader
          title="Feature explorer"
          subtitle="How each input is distributed, and how the target actually responds to it."
          action={
            <div className="w-48">
              <Field label="" htmlFor="analytics-feature">
                <Select
                  id="analytics-feature"
                  value={feature}
                  onChange={(next) => setFeature(next as FeatureKey)}
                  options={features.map((f) => ({ value: f.key, label: f.label }))}
                />
              </Field>
            </div>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-ink">
              Distribution of {activeFeature.label.toLowerCase()}
            </h3>
            <VerticalBars
              data={histogram.centers.map((center, index) => ({
                key: String(center),
                label: num(center, 0),
                value: histogram.counts[index],
                color: FEATURE_COLOR[feature],
              }))}
              height={210}
              yLabel="Students"
              xLabel={`${activeFeature.label}${unitSuffix(activeFeature.unit)}`}
              formatValue={(value) => int(value)}
              tableCaption={`Distribution of ${activeFeature.label}`}
            />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-ink">
              Mean score by decile of {activeFeature.label.toLowerCase()}
            </h3>
            <LineChart
              height={210}
              series={[
                {
                  key: "mean",
                  label: "Mean score",
                  color: FEATURE_COLOR[feature],
                  points: decile.map((point) => ({ x: point.bin_mid, y: point.mean_score })),
                  band: decile.map((point) => ({
                    x: point.bin_mid,
                    lower: point.p25,
                    upper: point.p75,
                  })),
                },
              ]}
              xLabel={`${activeFeature.label}${unitSuffix(activeFeature.unit)}`}
              yLabel="Final score"
              formatY={(value) => num(value, 0)}
              tableCaption={`Mean final score per decile of ${activeFeature.label}`}
            />
            <div className="mt-2">
              <Legend
                items={[
                  { label: "Mean score", color: FEATURE_COLOR[feature] },
                  { label: "Interquartile range (shaded)", color: FEATURE_COLOR[feature] },
                ]}
              />
            </div>
          </div>
        </div>

        <dl className="tabular mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 text-xs sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["Min", activeFeature.min],
            ["1st pct", activeFeature.p1],
            ["25th pct", activeFeature.p25],
            ["Median", activeFeature.median],
            ["75th pct", activeFeature.p75],
            ["99th pct", activeFeature.p99],
            ["Max", activeFeature.max],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-0.5 font-medium text-ink">{num(value as number, 1)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ---------------------------------------- Correlation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Correlation matrix"
            subtitle="Pearson r between every feature pair and the target."
          />
          <CorrelationHeatmap
            labels={analytics.correlation.labels}
            matrix={analytics.correlation.matrix}
          />
        </Card>

        <Card>
          <CardHeader
            title="Score percentile curve"
            subtitle="Where any given score sits in the cohort."
          />
          <LineChart
            height={260}
            series={[
              {
                key: "percentile",
                label: "Percentile",
                color: "var(--series-1)",
                points: analytics.score_percentiles.map((point) => ({
                  x: point.score,
                  y: point.p,
                })),
              },
            ]}
            xLabel="Final score"
            yLabel="Percentile"
            formatY={(value) => num(value, 0)}
            tableCaption="Score to percentile mapping"
          />
        </Card>
      </div>
    </div>
  );
}
