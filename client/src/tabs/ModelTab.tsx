import { AlertTriangle, Award, CheckCircle2, XCircle } from "lucide-react";
import { useCallback } from "react";

import { getImportance } from "../api/predictionApi";
import { HorizontalBars } from "../components/charts/BarChart";
import {
  Badge, Card, CardHeader, ErrorState, Skeleton, Stat,
} from "../components/ui";
import { useFetchOnMount } from "../hooks/useAsync";
import { FEATURE_COLOR, formatTimestamp, int, num, pct } from "../lib/format";
import type { ModelCatalogResponse } from "../types";

export function ModelTab({ catalog }: { catalog: ModelCatalogResponse | null }) {
  const task = useCallback(() => getImportance(), []);
  const importance = useFetchOnMount(task);

  if (!catalog) return <Skeleton className="h-96" />;

  const champion = catalog.models.find((model) => model.is_champion);
  const noSignal = importance.data?.signal_audit.filter(
    (entry) => entry.verdict === "no-signal",
  ) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------ Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Champion R²"
          value={num(champion?.metrics.r2, 4)}
          hint={champion?.label}
          accent="var(--series-1)"
        />
        <Stat label="MAE" value={num(champion?.metrics.mae, 3)} unit="pts" hint="Held-out mean absolute error" />
        <Stat label="RMSE" value={num(champion?.metrics.rmse, 3)} unit="pts" hint="Penalises large misses" />
        <Stat
          label="Within ±5 pts"
          value={`${num(champion?.metrics.within_5_points, 1)}%`}
          hint={`±10 pts: ${num(champion?.metrics.within_10_points, 1)}%`}
        />
        <Stat
          label="Training rows"
          value={int(catalog.dataset.train_rows)}
          hint={`${int(catalog.dataset.test_rows)} held out`}
        />
      </div>

      {/* ------------------------------------------------ Signal audit */}
      <Card>
        <CardHeader
          title="Feature signal audit"
          subtitle="Before trusting a model, check that its inputs actually carry information. Three independent tests are run per feature."
          icon={<AlertTriangle size={15} />}
        />

        {importance.error ? (
          <ErrorState message={importance.error} onRetry={importance.retry} />
        ) : !importance.data ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {noSignal.length > 0 && (
              <div
                className="mb-4 rounded-md border p-3"
                style={{
                  borderColor: "var(--warning)",
                  backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
                }}
              >
                <p className="text-xs font-medium text-ink">
                  {noSignal.length} of {importance.data.signal_audit.length} inputs
                  carry no measurable signal
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-2">
                  {noSignal.map((entry) => entry.label).join(" and ")}{" "}
                  {noSignal.length === 1 ? "is" : "are"} uncorrelated with the target
                  at every level of the other features. The model is served with them
                  intact so the audit stays visible, but they should not drive
                  intervention decisions — and any recommendation touching them is
                  flagged as ineffective in the Predict tab.
                </p>
              </div>
            )}

            <div className="scroll-x">
              <table className="w-full min-w-[620px] text-xs">
                <caption className="sr-only">
                  Per-feature evidence of predictive signal
                </caption>
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Feature</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Pearson r</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Spearman ρ</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Mutual info</th>
                    <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Permutation ΔR²</th>
                    <th scope="col" className="border-b border-hairline py-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {importance.data.signal_audit.map((entry) => {
                    const predictive = entry.verdict === "predictive";
                    return (
                      <tr key={entry.feature}>
                        <td className="border-b border-hairline py-2 pr-3">
                          <span className="flex items-center gap-1.5 text-ink">
                            <span
                              aria-hidden
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: FEATURE_COLOR[entry.feature] }}
                            />
                            {entry.label}
                          </span>
                        </td>
                        <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                          {num(entry.pearson_r, 4)}
                        </td>
                        <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                          {num(entry.spearman_r, 4)}
                        </td>
                        <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                          {num(entry.mutual_information, 4)}
                        </td>
                        <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                          {num(entry.permutation_r2_drop, 5)}
                        </td>
                        <td className="border-b border-hairline py-2">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* ------------------------------------------------ Importance */}
      {importance.data && (
        <Card>
          <CardHeader
            title="Permutation importance"
            subtitle="Drop in held-out R² when a feature's values are shuffled. Model-agnostic and immune to the cardinality bias that inflates impurity importance."
          />
          <HorizontalBars
            data={importance.data.importance.map((entry) => ({
              key: entry.feature,
              label: entry.label,
              value: Math.max(entry.permutation_importance, 0),
              color: FEATURE_COLOR[entry.feature],
              note:
                `${pct(entry.permutation_share, 1)} of total importance` +
                (entry.impurity_importance !== null
                  ? ` · impurity ${num(entry.impurity_importance, 3)}`
                  : ""),
            }))}
            formatValue={(value) => num(value, 4)}
            tableCaption="Permutation importance by feature"
            valueLabel="ΔR²"
          />
        </Card>
      )}

      {/* ------------------------------------------------ Leaderboard */}
      <Card>
        <CardHeader
          title="Model leaderboard"
          subtitle={`All models trained on the same split and scored on the same ${int(catalog.dataset.test_rows)} held-out rows.`}
          icon={<Award size={15} />}
        />

        <div className="scroll-x">
          <table className="w-full min-w-[860px] text-xs">
            <caption className="sr-only">Held-out metrics for every trained model</caption>
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Model</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">R²</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">CV R² (3-fold)</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">MAE</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">RMSE</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">MAPE</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">±5 pts</th>
                <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Fit time</th>
                <th scope="col" className="border-b border-hairline py-2 font-medium">Intervals</th>
              </tr>
            </thead>
            <tbody>
              {catalog.models.map((model) => (
                <tr key={model.key}>
                  <td className="border-b border-hairline py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{model.label}</span>
                      {model.is_champion && (
                        <Badge color="var(--series-1)">Champion</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{model.family}</p>
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 font-medium text-ink">
                    {num(model.metrics.r2, 4)}
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.cv_r2_mean, 4)}
                    <span className="text-muted"> ± {num(model.metrics.cv_r2_std, 4)}</span>
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.mae, 3)}
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.rmse, 3)}
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.mape, 2)}%
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.within_5_points, 1)}%
                  </td>
                  <td className="tabular border-b border-hairline py-2.5 pr-3 text-ink-2">
                    {num(model.metrics.train_seconds, 1)}s
                  </td>
                  <td className="border-b border-hairline py-2.5 text-[11px] text-ink-2">
                    {model.supports_tree_interval ? "Per-point (tree spread)" : "Residual-based"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 flex flex-col gap-1.5">
          {catalog.models.map((model) => (
            <li key={model.key} className="text-[11px] leading-relaxed text-muted">
              <span className="font-medium text-ink-2">{model.label}:</span>{" "}
              {model.notes}
            </li>
          ))}
        </ul>
      </Card>

      {/* ------------------------------------------------ Hyperparameters */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Hyperparameters" subtitle="As fitted, per model." />
          <div className="flex flex-col gap-4">
            {catalog.models.map((model) => (
              <div key={model.key}>
                <p className="mb-1.5 text-xs font-medium text-ink">{model.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(model.hyperparameters).map(([key, value]) => (
                    <span
                      key={key}
                      className="tabular rounded bg-surface-2 px-2 py-1 text-[11px] text-ink-2"
                    >
                      {key}={String(value)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Training run" subtitle="Provenance for this set of artifacts." />
          <dl className="grid grid-cols-2 gap-4 text-xs">
            {[
              ["Trained at", formatTimestamp(catalog.generated_at)],
              ["Total time", `${num(catalog.training_seconds, 1)}s`],
              ["Dataset", catalog.dataset.source],
              ["Rows", int(catalog.dataset.rows)],
              ["Train / test", `${int(catalog.dataset.train_rows)} / ${int(catalog.dataset.test_rows)}`],
              ["Random state", String(catalog.dataset.random_state)],
              ...Object.entries(catalog.environment).map(([key, value]) => [key, value]),
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
                <dd className="tabular mt-0.5 text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
