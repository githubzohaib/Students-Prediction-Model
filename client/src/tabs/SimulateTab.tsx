import { Copy, Crosshair, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { compareScenarios, goalSeek } from "../api/predictionApi";
import { VerticalBars } from "../components/charts/BarChart";
import { StudentInputs } from "../components/StudentInputs";
import { PRESETS } from "../components/StudentInputs";
import {
  Badge, Button, Card, CardHeader, ErrorState, Field, NumberInput, Select,
  Skeleton,
} from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { gradeColor, num, ordinal, signed, unitSuffix } from "../lib/format";
import type { FeatureSchema, NamedScenario, StudentProfile } from "../types";

interface Props {
  features: FeatureSchema[];
  profile: StudentProfile;
  setProfile: (profile: StudentProfile) => void;
  modelKey?: string;
  modelOptions: { value: string; label: string }[];
  setModelKey: (key: string) => void;
}

export function SimulateTab({
  features, profile, setProfile, modelKey, modelOptions, setModelKey,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-5">
        <Card>
          <CardHeader
            title="Baseline profile"
            subtitle="Goal seeking solves from this starting point."
          />
          <StudentInputs features={features} profile={profile} onChange={setProfile} />
        </Card>

        <GoalSeekPanel
          features={features}
          profile={profile}
          modelKey={modelKey}
        />
      </div>

      <div className="lg:col-span-7">
        <ScenarioPanel
          features={features}
          baseProfile={profile}
          modelKey={modelKey}
          modelOptions={modelOptions}
          setModelKey={setModelKey}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Goal seek */

function GoalSeekPanel({
  features, profile, modelKey,
}: {
  features: FeatureSchema[];
  profile: StudentProfile;
  modelKey?: string;
}) {
  const [target, setTarget] = useState(90);
  const [lever, setLever] = useState<string>(features[0]?.key ?? "study_hours");

  const task = useCallback(
    (input: StudentProfile, targetScore: number, leverKey: string, model?: string) =>
      goalSeek(input, targetScore, leverKey, model),
    [],
  );
  const { data, error, loading, run } = useAsync(task);

  return (
    <Card>
      <CardHeader
        title="Goal seek"
        subtitle="Solve for the lever value that reaches a target score."
        icon={<Crosshair size={15} />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target score" htmlFor="goal-target">
          <NumberInput
            id="goal-target"
            value={target}
            min={0}
            max={100}
            step={1}
            onChange={setTarget}
          />
        </Field>

        <Field label="Lever to adjust" htmlFor="goal-lever">
          <Select
            id="goal-lever"
            value={lever}
            onChange={setLever}
            options={features.map((feature) => ({
              value: feature.key,
              label: feature.label,
            }))}
          />
        </Field>
      </div>

      <Button
        className="mt-3 w-full"
        variant="primary"
        loading={loading}
        onClick={() => run(profile, target, lever, modelKey)}
      >
        Solve
      </Button>

      {error && (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      )}

      {data && (
        <div
          className="mt-3 rounded-md border p-3"
          style={{
            borderColor: data.feasible ? "var(--good)" : "var(--critical)",
            backgroundColor: `color-mix(in srgb, ${
              data.feasible ? "var(--good)" : "var(--critical)"
            } 8%, transparent)`,
          }}
        >
          <p className="text-xs leading-relaxed text-ink">{data.message}</p>

          <dl className="tabular mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Now</dt>
              <dd className="font-medium text-ink">
                {num(data.current_value, 1)}
                {unitSuffix(data.unit)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Needed</dt>
              <dd className="font-medium text-ink">
                {data.required_value !== null
                  ? `${num(data.required_value, 1)}${unitSuffix(data.unit)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Change</dt>
              <dd className="font-medium text-ink">
                {data.delta !== null ? signed(data.delta, 1) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted">Ceiling</dt>
              <dd className="font-medium text-ink">
                {num(data.max_achievable_score, 1)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Scenarios */

let scenarioCounter = 0;

function ScenarioPanel({
  features, baseProfile, modelKey, modelOptions, setModelKey,
}: {
  features: FeatureSchema[];
  baseProfile: StudentProfile;
  modelKey?: string;
  modelOptions: { value: string; label: string }[];
  setModelKey: (key: string) => void;
}) {
  const [scenarios, setScenarios] = useState<(NamedScenario & { id: number })[]>(
    () =>
      PRESETS.slice(0, 3).map((preset) => ({
        id: ++scenarioCounter,
        name: preset.name,
        ...preset.profile,
      })),
  );

  const task = useCallback(
    (items: NamedScenario[], model?: string) => compareScenarios(items, model),
    [],
  );
  const { data, error, loading, run } = useAsync(task);

  const addScenario = () => {
    if (scenarios.length >= 8) return;
    setScenarios((prev) => [
      ...prev,
      { id: ++scenarioCounter, name: `Scenario ${prev.length + 1}`, ...baseProfile },
    ]);
  };

  const updateScenario = (id: number, patch: Partial<NamedScenario>) => {
    setScenarios((prev) =>
      prev.map((scenario) =>
        scenario.id === id ? { ...scenario, ...patch } : scenario,
      ),
    );
  };

  const removeScenario = (id: number) => {
    setScenarios((prev) => prev.filter((scenario) => scenario.id !== id));
  };

  return (
    <Card>
      <CardHeader
        title="Scenario comparison"
        subtitle="Score up to eight profiles side by side. Deltas are measured against the first row."
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={addScenario} disabled={scenarios.length >= 8}>
              <Plus size={13} aria-hidden />
              Add
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={loading}
              disabled={scenarios.length === 0}
              onClick={() =>
                run(
                  scenarios.map(({ id: _id, ...rest }) => rest),
                  modelKey,
                )
              }
            >
              Compare
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-xs">
        <Field label="Estimator" htmlFor="sim-model">
          <Select
            id="sim-model"
            value={modelKey ?? ""}
            onChange={setModelKey}
            options={modelOptions}
          />
        </Field>
      </div>

      {/* ------------------------------------------------- Editors */}
      <div className="scroll-x">
        <table className="w-full min-w-[560px] text-xs">
          <caption className="sr-only">Scenario input editor</caption>
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
              <th scope="col" className="pb-2 pr-2 font-medium">Name</th>
              {features.map((feature) => (
                <th key={feature.key} scope="col" className="pb-2 pr-2 font-medium">
                  {feature.short}
                </th>
              ))}
              <th scope="col" className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    value={scenario.name}
                    aria-label="Scenario name"
                    onChange={(event) =>
                      updateScenario(scenario.id, { name: event.target.value })
                    }
                    className="w-32 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
                  />
                </td>
                {features.map((feature) => (
                  <td key={feature.key} className="py-1 pr-2">
                    <input
                      type="number"
                      value={scenario[feature.key]}
                      min={feature.min}
                      max={feature.max}
                      step={feature.step}
                      aria-label={`${scenario.name} ${feature.label}`}
                      onChange={(event) =>
                        updateScenario(scenario.id, {
                          [feature.key]: Number(event.target.value),
                        } as Partial<NamedScenario>)
                      }
                      className="tabular w-20 rounded-md border border-hairline bg-surface px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                ))}
                <td className="py-1">
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setScenarios((prev) => [
                          ...prev,
                          { ...scenario, id: ++scenarioCounter, name: `${scenario.name} copy` },
                        ])
                      }
                      disabled={scenarios.length >= 8}
                      className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      aria-label={`Duplicate ${scenario.name}`}
                      title="Duplicate"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => removeScenario(scenario.id)}
                      className="rounded p-1 text-muted hover:bg-surface-2"
                      style={{ color: undefined }}
                      aria-label={`Remove ${scenario.name}`}
                      title="Remove"
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

      {/* ------------------------------------------------- Results */}
      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      {loading && !data && <Skeleton className="mt-4 h-48" />}

      {data && (
        <div className="mt-5 flex flex-col gap-4">
          <VerticalBars
            data={data.results.map((result) => ({
              key: result.name,
              label: result.name,
              value: result.predicted_score,
              color: gradeColor(result.grade),
              note: `Grade ${result.grade} · ${ordinal(result.percentile)} percentile`,
            }))}
            height={220}
            yLabel="Predicted score"
            formatValue={(value) => num(value, 0)}
            tableCaption="Predicted score by scenario"
            rotateLabels={data.results.length > 4}
          />

          <p className="text-[11px] text-muted">
            Bar colour encodes the grade band; the grade is also named in each row
            of the table below.
          </p>

          <div className="scroll-x">
            <table className="w-full min-w-[520px] text-xs">
              <caption className="sr-only">Scenario comparison results</caption>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                  <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Scenario</th>
                  <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Score</th>
                  <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Grade</th>
                  <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">95% CI</th>
                  <th scope="col" className="border-b border-hairline py-2 pr-3 font-medium">Percentile</th>
                  <th scope="col" className="border-b border-hairline py-2 font-medium">vs first</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((result) => (
                  <tr key={result.name}>
                    <td className="border-b border-hairline py-2 pr-3 text-ink">
                      {result.name}
                      {result.name === data.best && (
                        <Badge subtle>
                          <span className="text-[10px]">best</span>
                        </Badge>
                      )}
                    </td>
                    <td className="tabular border-b border-hairline py-2 pr-3 font-medium text-ink">
                      {num(result.predicted_score, 1)}
                    </td>
                    <td className="border-b border-hairline py-2 pr-3">
                      <Badge color={gradeColor(result.grade)}>{result.grade}</Badge>
                    </td>
                    <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                      {num(result.confidence.lower, 0)}–{num(result.confidence.upper, 0)}
                    </td>
                    <td className="tabular border-b border-hairline py-2 pr-3 text-ink-2">
                      {ordinal(result.percentile)}
                    </td>
                    <td
                      className="tabular border-b border-hairline py-2 font-medium"
                      style={{
                        color:
                          result.delta_vs_baseline > 0
                            ? "var(--success-text)"
                            : result.delta_vs_baseline < 0
                              ? "var(--critical)"
                              : "var(--muted)",
                      }}
                    >
                      {signed(result.delta_vs_baseline, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="tabular text-[11px] text-muted">
            Spread between best ({data.best}) and worst ({data.worst}):{" "}
            {num(data.spread, 1)} points.
          </p>
        </div>
      )}
    </Card>
  );
}
