import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useCallback, useEffect } from "react";

import { getAttribution, getImportance, getSensitivity } from "../api/predictionApi";
import { HorizontalBars } from "../components/charts/BarChart";
import { LineChart } from "../components/charts/LineChart";
import { Waterfall } from "../components/charts/Waterfall";
import { StudentInputs } from "../components/StudentInputs";
import {
  Badge, Card, CardHeader, ErrorState, Field, Legend, Select, Skeleton,
} from "../components/ui";
import { useAsync, useDebounced, useFetchOnMount } from "../hooks/useAsync";
import { FEATURE_COLOR, num, signed, unitSuffix } from "../lib/format";
import type { FeatureSchema, StudentProfile } from "../types";

interface Props {
  features: FeatureSchema[];
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
  modelKey?: string;
  setModelKey: (key: string) => void;
  modelOptions: { value: string; label: string }[];
}

export function ExplainTab({
  features, profile, setProfile, modelKey, setModelKey, modelOptions,
}: Props) {
  const attributionTask = useCallback(
    (input: StudentProfile, model?: string) => getAttribution(input, model),
    [],
  );
  const sensitivityTask = useCallback(
    (input: StudentProfile, model?: string) => getSensitivity(input, model, 44),
    [],
  );
  const importanceTask = useCallback(() => getImportance(), []);

  const attribution = useAsync(attributionTask);
  const sensitivity = useAsync(sensitivityTask);
  const importance = useFetchOnMount(importanceTask);

  const debounced = useDebounced(profile, 350);

  useEffect(() => {
    attribution.run(debounced, modelKey);
    sensitivity.run(debounced, modelKey);
    // The run callbacks are stable; re-running on their identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, modelKey]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-4">
        <Card>
          <CardHeader
            title="Student profile"
            subtitle="Explanations recompute as you change the inputs."
          />
          <StudentInputs features={features} profile={profile} onChange={setProfile} />
        </Card>

        <Card>
          <CardHeader title="Model" />
          <Field label="Estimator" htmlFor="explain-model">
            <Select
              id="explain-model"
              value={modelKey ?? ""}
              onChange={setModelKey}
              options={modelOptions}
            />
          </Field>
        </Card>

        <SignalAudit importance={importance} />
      </div>

      <div className="flex flex-col gap-4 lg:col-span-8">
        {/* --------------------------------------------- Attribution */}
        <Card>
          <CardHeader
            title="Why this score?"
            subtitle={
              attribution.data
                ? `${attribution.data.method}, marginalised over ${attribution.data.background_size} background rows.`
                : "Exact Shapley decomposition of the prediction."
            }
          />

          {attribution.error ? (
            <ErrorState
              message={attribution.error}
              onRetry={() => attribution.run(profile, modelKey)}
            />
          ) : !attribution.data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <Waterfall
                baseline={attribution.data.baseline}
                prediction={attribution.data.prediction}
                steps={attribution.data.contributions.map((contribution) => ({
                  key: contribution.feature,
                  label: contribution.label,
                  value: contribution.contribution,
                  detail: `Input value ${num(contribution.value, 1)}`,
                }))}
              />

              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                Shapley values satisfy efficiency: the contributions sum exactly to
                prediction − baseline. Residual here is{" "}
                <span className="tabular">
                  {num(attribution.data.residual, 6)}
                </span>
                .
              </p>
            </>
          )}
        </Card>

        {/* --------------------------------------------- Contributions */}
        {attribution.data && (
          <Card>
            <CardHeader
              title="Attribution magnitude"
              subtitle="Share of total absolute contribution carried by each feature."
            />
            <HorizontalBars
              data={attribution.data.contributions.map((contribution) => ({
                key: contribution.feature,
                label: contribution.label,
                value: Math.abs(contribution.contribution),
                color: FEATURE_COLOR[contribution.feature],
                note:
                  `${signed(contribution.contribution, 2)} pts · ` +
                  `${num(contribution.share * 100, 1)}% of attribution · ` +
                  `${contribution.direction}`,
              }))}
              formatValue={(value) => `${num(value, 2)} pts`}
              tableCaption="Absolute Shapley contribution by feature"
              valueLabel="|contribution|"
            />
          </Card>
        )}

        {/* --------------------------------------------- Sensitivity */}
        <Card>
          <CardHeader
            title="Response curves"
            subtitle="Each feature swept across its full range while the others stay at this student's values."
          />

          {sensitivity.error ? (
            <ErrorState
              message={sensitivity.error}
              onRetry={() => sensitivity.run(profile, modelKey)}
            />
          ) : !sensitivity.data ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {sensitivity.data.curves.map((curve) => (
                <div key={curve.feature}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-medium text-ink">{curve.label}</h3>
                    <span className="tabular text-[11px] text-muted">
                      swing {num(curve.swing, 1)} pts
                    </span>
                  </div>

                  <LineChart
                    height={190}
                    series={[
                      {
                        key: curve.feature,
                        label: "Predicted score",
                        color: FEATURE_COLOR[curve.feature],
                        points: curve.points,
                      },
                    ]}
                    marker={{ x: curve.current_value, label: "now" }}
                    xLabel={`${curve.label}${unitSuffix(curve.unit)}`}
                    yLabel="Score"
                    // A near-flat curve needs decimals, or every tick prints
                    // the same integer and the axis reads as broken.
                    formatY={(value) =>
                      num(value, curve.swing < 1 ? 2 : curve.swing < 5 ? 1 : 0)
                    }
                    tableCaption={`Predicted score across ${curve.label}`}
                  />

                  {curve.swing < 0.5 && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      Flat across the whole range — this feature does not move the
                      prediction.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {sensitivity.data && (
            <div className="mt-4">
              <Legend
                items={sensitivity.data.curves.map((curve) => ({
                  label: curve.label,
                  color: FEATURE_COLOR[curve.feature],
                }))}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Signal audit */

function SignalAudit({
  importance,
}: {
  importance: ReturnType<typeof useFetchOnMount<Awaited<ReturnType<typeof getImportance>>>>;
}) {
  return (
    <Card>
      <CardHeader
        title="Feature signal audit"
        subtitle="Does each input actually carry information about the target?"
      />

      {importance.error ? (
        <ErrorState message={importance.error} onRetry={importance.retry} />
      ) : !importance.data ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {importance.data.signal_audit.map((entry) => {
            const predictive = entry.verdict === "predictive";
            return (
              <li
                key={entry.feature}
                className="rounded-md border border-hairline p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-ink">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: FEATURE_COLOR[entry.feature] }}
                    />
                    {entry.label}
                  </span>
                  <Badge
                    color={predictive ? "var(--good)" : "var(--critical)"}
                    icon={
                      predictive ? (
                        <CheckCircle2 size={11} aria-hidden />
                      ) : (
                        <XCircle size={11} aria-hidden />
                      )
                    }
                  >
                    {predictive ? "Predictive" : "No signal"}
                  </Badge>
                </div>

                <dl className="tabular mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <dt className="text-muted">Pearson r</dt>
                    <dd className="text-ink">{num(entry.pearson_r, 3)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Mutual info</dt>
                    <dd className="text-ink">{num(entry.mutual_information, 3)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Perm ΔR²</dt>
                    <dd className="text-ink">{num(entry.permutation_r2_drop, 4)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
