import {
  Activity, BarChart3, Database, FlaskConical, GraduationCap, History,
  Layers, Lightbulb, Moon, Sun, Target,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { getFeatureSchema, getHealth, getModelCatalog } from "./api/predictionApi";
import { DEFAULT_PROFILE } from "./components/StudentInputs";
import { ErrorState, Skeleton } from "./components/ui";
import { useFetchOnMount } from "./hooks/useAsync";
import { useTheme } from "./hooks/useTheme";
import { cx, int } from "./lib/format";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { BatchTab } from "./tabs/BatchTab";
import { ExplainTab } from "./tabs/ExplainTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { ModelTab } from "./tabs/ModelTab";
import { PredictTab } from "./tabs/PredictTab";
import { SimulateTab } from "./tabs/SimulateTab";
import type { StudentProfile } from "./types";

const TABS = [
  { key: "predict", label: "Predict", icon: Target,
    blurb: "Score a student with uncertainty, risk and levers" },
  { key: "explain", label: "Explain", icon: Lightbulb,
    blurb: "Shapley attribution and per-feature response curves" },
  { key: "simulate", label: "Simulate", icon: FlaskConical,
    blurb: "Goal seeking and side-by-side scenarios" },
  { key: "batch", label: "Batch", icon: Layers,
    blurb: "Score a whole roster from CSV" },
  { key: "analytics", label: "Analytics", icon: BarChart3,
    blurb: "Explore the training dataset" },
  { key: "model", label: "Model", icon: Database,
    blurb: "Leaderboard, metrics and the feature signal audit" },
  { key: "history", label: "History", icon: History,
    blurb: "Saved predictions on this device" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function App() {
  const [tab, setTab] = useState<TabKey>("predict");
  const [profile, setProfile] = useState<StudentProfile>(DEFAULT_PROFILE);
  const [modelKey, setModelKey] = useState<string | undefined>(undefined);

  const { resolved, toggle } = useTheme();

  const schemaTask = useCallback(() => getFeatureSchema(), []);
  const catalogTask = useCallback(() => getModelCatalog(), []);
  const healthTask = useCallback(() => getHealth(), []);

  const schema = useFetchOnMount(schemaTask);
  const catalog = useFetchOnMount(catalogTask);
  const health = useFetchOnMount(healthTask);

  const modelOptions = useMemo(
    () =>
      (catalog.data?.models ?? []).map((model) => ({
        value: model.key,
        label: model.is_champion ? `${model.label} (champion)` : model.label,
      })),
    [catalog.data],
  );

  const activeModel = modelKey ?? catalog.data?.champion;

  const bootFailed = schema.error || catalog.error;

  const retryBoot = () => {
    schema.retry();
    catalog.retry();
    health.retry();
  };

  const shared = {
    features: schema.data ?? [],
    profile,
    setProfile,
    modelKey: activeModel,
    setModelKey,
    modelOptions,
    catalog: catalog.data,
  };

  return (
    <div className="page-bg min-h-screen bg-page">
      <header className="sticky top-0 z-20 border-b border-hairline bg-page/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="gradient-bg flex h-10 w-10 items-center justify-center rounded-xl shadow-glow"
              aria-hidden
            >
              <GraduationCap size={20} color="#fff" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-sm font-semibold leading-tight tracking-tight text-ink">
                Student Performance Intelligence
              </h1>
              <p className="text-[11px] leading-tight text-muted">
                {health.data
                  ? `${int(health.data.dataset_rows)} training records · ${health.data.models.length} models`
                  : "Predictive analytics workbench"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {health.data && (
              <span className="hidden items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 sm:flex">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--good)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--good) 20%, transparent)" }}
                  aria-hidden
                />
                API v{health.data.version}
              </span>
            )}
            {health.error && (
              <span className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex"
                    style={{ color: "var(--critical)", backgroundColor: "color-mix(in srgb, var(--critical) 10%, transparent)" }}>
                <Activity size={12} aria-hidden />
                API unreachable
              </span>
            )}
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
            >
              {resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        <nav aria-label="Sections" className="mx-auto max-w-[1400px] px-4 pb-3 sm:px-6">
          <div className="scroll-x">
            <div className="flex w-fit gap-1 rounded-full bg-surface-2/70 p-1">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    aria-current={active ? "page" : undefined}
                    title={item.blurb}
                    className={cx(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5",
                      "text-xs font-medium transition-all duration-150",
                      active
                        ? "gradient-bg text-white shadow-sm"
                        : "text-muted hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    <Icon size={14} aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {bootFailed ? (
          <ErrorState message={schema.error ?? catalog.error ?? ""} onRetry={retryBoot} />
        ) : schema.loading || catalog.loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-1" />
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-40 lg:col-span-3" />
          </div>
        ) : (
          <div key={tab} className="animate-fade-up">
            {tab === "predict" && <PredictTab {...shared} />}
            {tab === "explain" && <ExplainTab {...shared} />}
            {tab === "simulate" && <SimulateTab {...shared} />}
            {tab === "batch" && <BatchTab {...shared} />}
            {tab === "analytics" && <AnalyticsTab />}
            {tab === "model" && <ModelTab catalog={catalog.data} />}
            {tab === "history" && <HistoryTab onLoad={(entry) => {
              setProfile(entry.inputs);
              setTab("predict");
            }} />}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 sm:px-6">
        <p className="text-[11px] leading-relaxed text-muted">
          Predictions are model estimates with quantified uncertainty, not
          determinations about any individual. Review the Model tab for held-out
          performance and the per-feature signal audit before acting on a result.
        </p>
      </footer>
    </div>
  );
}
