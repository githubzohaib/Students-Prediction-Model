import {
  AlertTriangle, Download, Info, Save, Sparkles, TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { predictScore } from "../api/predictionApi";
import { Gauge } from "../components/charts/Gauge";
import { HorizontalBars } from "../components/charts/BarChart";
import { StudentInputs } from "../components/StudentInputs";
import {
  Badge, Button, Card, CardHeader, ErrorState, Field, Select, Skeleton, Stat,
} from "../components/ui";
import { useAsync, useDebounced } from "../hooks/useAsync";
import { exportPredictionPdf } from "../lib/export";
import {
  FEATURE_COLOR, RISK_COLOR, RISK_ICON, num, ordinal, signed,
} from "../lib/format";
import { saveToHistory } from "../lib/storage";
import type { FeatureSchema, PredictionResponse, StudentProfile } from "../types";

interface Props {
  features: FeatureSchema[];
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
  modelKey?: string;
  setModelKey: (key: string) => void;
  modelOptions: { value: string; label: string }[];
}

export function PredictTab({
  features, profile, setProfile, modelKey, setModelKey, modelOptions,
}: Props) {
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);

  const task = useCallback(
    (input: StudentProfile, model?: string) => predictScore(input, model),
    [],
  );
  const { data, error, loading, run } = useAsync(task);

  // Sliders fire continuously; debounce so one drag is one request.
  const debouncedProfile = useDebounced(profile, 300);

  useEffect(() => {
    run(debouncedProfile, modelKey);
    setSaved(false);
  }, [debouncedProfile, modelKey, run]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ------------------------------------------------------- Inputs */}
      <div className="flex flex-col gap-4 lg:col-span-4">
        <Card>
          <CardHeader
            title="Student profile"
            subtitle="Adjust the inputs — the prediction updates automatically."
          />
          <StudentInputs
            features={features}
            profile={profile}
            onChange={setProfile}
          />
        </Card>

        <Card>
          <CardHeader title="Model" subtitle="Every model was scored on the same held-out split." />
          <Field label="Estimator" htmlFor="model-select">
            <Select
              id="model-select"
              value={modelKey ?? ""}
              onChange={setModelKey}
              options={modelOptions}
            />
          </Field>
          {data && (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted">Test R²</dt>
                <dd className="tabular font-medium text-ink">
                  {num(data.model_used.r2, 4)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Test MAE</dt>
                <dd className="tabular font-medium text-ink">
                  {num(data.model_used.mae, 3)} pts
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------- Result */}
      <div className="flex flex-col gap-4 lg:col-span-8">
        {error ? (
          <ErrorState message={error} onRetry={() => run(profile, modelKey)} />
        ) : !data && loading ? (
          <Skeleton className="h-80" />
        ) : data ? (
          <>
            <Card>
              <CardHeader
                title="Predicted final score"
                subtitle={`Scored with ${data.model_used.label}.`}
                action={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        saveToHistory(data, label);
                        setSaved(true);
                      }}
                      title="Save to local history"
                    >
                      <Save size={13} aria-hidden />
                      {saved ? "Saved" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => exportPredictionPdf(data, label)}
                      title="Export a PDF report"
                    >
                      <Download size={13} aria-hidden />
                      PDF
                    </Button>
                  </div>
                }
              />

              <div className="grid items-center gap-6 sm:grid-cols-2">
                <Gauge
                  score={data.predicted_score}
                  lower={data.confidence.lower}
                  upper={data.confidence.upper}
                  grade={data.grade}
                  cohortMean={data.cohort_mean}
                />

                <div className="flex flex-col gap-3">
                  <RiskPanel prediction={data} />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-surface-2 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        Cohort rank
                      </p>
                      <p className="tabular mt-0.5 text-sm font-semibold text-ink">
                        {ordinal(data.percentile)} pct
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-2 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted">
                        vs cohort mean
                      </p>
                      <p
                        className="tabular mt-0.5 text-sm font-semibold"
                        style={{
                          color:
                            data.delta_vs_cohort >= 0
                              ? "var(--success-text)"
                              : "var(--critical)",
                        }}
                      >
                        {signed(data.delta_vs_cohort, 1)} pts
                      </p>
                    </div>
                  </div>

                  <Field label="Report label (optional)" htmlFor="report-label">
                    <input
                      id="report-label"
                      type="text"
                      value={label}
                      placeholder="e.g. Ayesha K. — Term 2"
                      onChange={(event) => setLabel(event.target.value)}
                      className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink"
                    />
                  </Field>
                </div>
              </div>

              {data.warnings.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {data.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex items-start gap-2 rounded-md p-2.5 text-xs text-ink"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--warning) 14%, transparent)",
                      }}
                    >
                      <AlertTriangle
                        size={14}
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--warning)" }}
                        aria-hidden
                      />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-4">
              <Stat
                label="Predicted"
                value={num(data.predicted_score, 1)}
                unit="/ 100"
                hint={`Grade ${data.grade}`}
              />
              <Stat
                label="95% interval"
                value={`${num(data.confidence.lower, 0)}–${num(data.confidence.upper, 0)}`}
                hint={`± ${num((data.confidence.upper - data.confidence.lower) / 2, 1)} pts`}
              />
              <Stat
                label="Risk score"
                value={num(data.risk.score, 0)}
                unit="/ 100"
                hint={data.risk.label}
                accent={RISK_COLOR[data.risk.level]}
              />
              <Stat
                label="Percentile"
                value={ordinal(data.percentile)}
                hint={`Cohort mean ${num(data.cohort_mean, 1)}`}
              />
            </div>

            <Recommendations prediction={data} />
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Sub-views */

function RiskPanel({ prediction }: { prediction: PredictionResponse }) {
  const { risk } = prediction;
  const color = RISK_COLOR[risk.level];

  return (
    <div
      className="rounded-md border p-3"
      style={{
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {RISK_ICON[risk.level]}
          </span>
          <span className="text-sm font-semibold text-ink">{risk.label}</span>
        </span>
        <span className="tabular text-xs text-ink-2">
          {num(risk.score, 1)}% chance below 55
        </span>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {risk.factors.slice(0, 3).map((factor, index) => (
          <li key={index} className="text-[11px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">{factor.label}:</span>{" "}
            {factor.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Recommendations({ prediction }: { prediction: PredictionResponse }) {
  const effective = prediction.recommendations.filter((r) => r.effective);
  const inert = prediction.recommendations.filter((r) => !r.effective);

  return (
    <Card>
      <CardHeader
        title="Improvement levers"
        subtitle="Each lever is probed through the model itself — the gain is measured, not assumed."
        icon={<TrendingUp size={15} />}
      />

      {effective.length > 0 ? (
        <HorizontalBars
          data={effective.map((rec) => ({
            key: rec.feature,
            label: rec.action,
            value: rec.projected_gain,
            color: FEATURE_COLOR[rec.feature],
          }))}
          formatValue={(value) => `+${num(value, 2)} pts`}
          tableCaption="Projected score gain per lever"
          valueLabel="Projected gain"
        />
      ) : (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          No lever produces a measurable gain from here — the profile is already at
          the top of the model's response surface.
        </p>
      )}

      {inert.length > 0 && (
        <div className="mt-4 rounded-md bg-surface-2 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
            <Info size={12} aria-hidden />
            Levers with no measurable effect
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {inert.map((rec) => (
              <li key={rec.feature} className="text-[11px] leading-relaxed text-ink-2">
                <Badge subtle>{rec.label}</Badge>{" "}
                {rec.action}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            This is a property of the training data, not a bug — see the signal
            audit in the Model tab.
          </p>
        </div>
      )}
    </Card>
  );
}
