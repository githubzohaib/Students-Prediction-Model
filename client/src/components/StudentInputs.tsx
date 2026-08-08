import { RotateCcw } from "lucide-react";

import { FEATURE_COLOR, num, unitSuffix } from "../lib/format";
import type { FeatureSchema, StudentProfile } from "../types";
import { Button, NumberInput } from "./ui";

export const DEFAULT_PROFILE: StudentProfile = {
  study_hours: 15,
  attendance: 85,
  participation: 6,
};

/** Quick-fill archetypes so the app is explorable without typing. */
export const PRESETS: { name: string; profile: StudentProfile }[] = [
  { name: "High achiever", profile: { study_hours: 24, attendance: 96, participation: 8.5 } },
  { name: "Cohort median", profile: { study_hours: 15, attendance: 85, participation: 6 } },
  { name: "Needs support", profile: { study_hours: 5, attendance: 68, participation: 3 } },
  { name: "At risk", profile: { study_hours: 1.5, attendance: 55, participation: 1 } },
];

function Slider({
  feature, value, onChange,
}: {
  feature: FeatureSchema;
  value: number;
  onChange: (value: number) => void;
}) {
  const ratio = ((value - feature.min) / (feature.max - feature.min)) * 100;
  const color = FEATURE_COLOR[feature.key];

  return (
    <input
      type="range"
      min={feature.min}
      max={feature.max}
      step={feature.step}
      value={value}
      aria-label={feature.label}
      onChange={(event) => onChange(Number(event.target.value))}
      className="spm-slider h-2 w-full cursor-pointer appearance-none rounded-full"
      style={{
        background: `linear-gradient(90deg, ${color} ${ratio}%, var(--surface-3) ${ratio}%)`,
        // Consumed by the thumb rules in the style block below.
        ["--thumb" as string]: color,
      }}
    />
  );
}

export function StudentInputs({
  features, profile, onChange, showPresets = true,
}: {
  features: FeatureSchema[];
  profile: StudentProfile;
  onChange: (profile: StudentProfile) => void;
  showPresets?: boolean;
}) {
  const update = (key: keyof StudentProfile, value: number) => {
    const feature = features.find((f) => f.key === key);
    const clamped = feature
      ? Math.min(Math.max(value, feature.min), feature.max)
      : value;
    onChange({ ...profile, [key]: clamped });
  };

  return (
    <div className="flex flex-col gap-5">
      <style>{`
        .spm-slider {
          transition: box-shadow 0.15s ease;
        }
        .spm-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 17px; width: 17px; border-radius: 999px;
          background: var(--thumb);
          border: 2.5px solid var(--surface);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25), 0 0 0 1px color-mix(in srgb, var(--thumb) 40%, transparent);
          cursor: pointer;
          transition: transform 0.12s ease;
        }
        .spm-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .spm-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--thumb) 30%, transparent);
        }
        .spm-slider::-moz-range-thumb {
          height: 17px; width: 17px; border-radius: 999px;
          background: var(--thumb);
          border: 2.5px solid var(--surface);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25), 0 0 0 1px color-mix(in srgb, var(--thumb) 40%, transparent);
          cursor: pointer;
          transition: transform 0.12s ease;
        }
        .spm-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
        }
      `}</style>

      {features.map((feature) => {
        const value = profile[feature.key];
        return (
          <div key={feature.key}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor={`input-${feature.key}`}
                className="text-xs font-medium text-ink"
              >
                {feature.label}
              </label>
              <span className="text-[11px] text-muted">
                cohort median {num(feature.median, 1)}
                {unitSuffix(feature.unit)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Slider
                feature={feature}
                value={value}
                onChange={(next) => update(feature.key, next)}
              />
              <div className="w-24 shrink-0">
                <NumberInput
                  id={`input-${feature.key}`}
                  value={value}
                  min={feature.min}
                  max={feature.max}
                  step={feature.step}
                  onChange={(next) => update(feature.key, next)}
                />
              </div>
            </div>

            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {feature.description} Range {num(feature.min, 0)}–{num(feature.max, 0)}
              {unitSuffix(feature.unit)}.
            </p>
          </div>
        );
      })}

      {showPresets && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Presets
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.name}
                size="sm"
                onClick={() => onChange(preset.profile)}
              >
                {preset.name}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(DEFAULT_PROFILE)}
              title="Reset to defaults"
            >
              <RotateCcw size={13} aria-hidden />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
