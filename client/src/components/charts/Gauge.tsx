import { useEffect, useRef, useState } from "react";

import { gradeColor, num } from "../../lib/format";

interface GaugeProps {
  score: number;
  lower: number;
  upper: number;
  grade: string;
  min?: number;
  max?: number;
  cohortMean?: number;
}

const START_ANGLE = -220;
const END_ANGLE = 40;
const RADIUS = 88;
const CENTER = 110;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(fromAngle: number, toAngle: number, radius: number): string {
  const start = polar(fromAngle, radius);
  const end = polar(toAngle, radius);
  const largeArc = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Animates a number toward its target, respecting reduced-motion. */
function useAnimatedValue(target: number, duration = 650): number {
  const [value, setValue] = useState(target);
  const frame = useRef<number>();
  const from = useRef(target);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const origin = from.current;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - (1 - progress) ** 3;
      setValue(origin + (target - origin) * eased);

      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      from.current = target;
    };
  }, [target, duration]);

  return value;
}

/**
 * Hero figure: the predicted score as a radial gauge, with the 95% interval
 * drawn as a band so the uncertainty is as visible as the point estimate.
 */
export function Gauge({
  score, lower, upper, grade, min = 0, max = 100, cohortMean,
}: GaugeProps) {
  const animated = useAnimatedValue(score);

  const toAngle = (value: number) => {
    const clamped = Math.min(Math.max(value, min), max);
    const ratio = (clamped - min) / (max - min);
    return START_ANGLE + ratio * (END_ANGLE - START_ANGLE);
  };

  const color = gradeColor(grade);
  const valueAngle = toAngle(animated);

  return (
    <figure className="m-0 flex flex-col items-center">
      <svg
        viewBox="0 0 220 190"
        className="w-full max-w-[260px]"
        role="img"
        aria-label={
          `Predicted score ${num(score, 1)} out of ${max}, grade ${grade}. ` +
          `95% confidence interval ${num(lower, 1)} to ${num(upper, 1)}.`
        }
      >
        {/* Track */}
        <path
          d={arcPath(START_ANGLE, END_ANGLE, RADIUS)}
          fill="none"
          stroke="var(--grid)"
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* 95% interval band, drawn beneath the value arc */}
        <path
          d={arcPath(toAngle(lower), toAngle(upper), RADIUS)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          opacity={0.22}
        />

        {/* Value arc */}
        <path
          d={arcPath(START_ANGLE, valueAngle, RADIUS)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* Cohort mean reference tick */}
        {cohortMean !== undefined && (
          <g aria-hidden>
            <line
              x1={polar(toAngle(cohortMean), RADIUS - 11).x}
              y1={polar(toAngle(cohortMean), RADIUS - 11).y}
              x2={polar(toAngle(cohortMean), RADIUS + 11).x}
              y2={polar(toAngle(cohortMean), RADIUS + 11).y}
              stroke="var(--ink-2)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Needle cap on the current value */}
        <circle
          cx={polar(valueAngle, RADIUS).x}
          cy={polar(valueAngle, RADIUS).y}
          r={6}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={2}
        />

        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          fontSize={40}
          fontWeight={600}
          fill="var(--ink)"
        >
          {num(animated, 1)}
        </text>
        <text
          x={CENTER}
          y={CENTER + 18}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted)"
        >
          out of {max}
        </text>

        {/* Scale end labels */}
        <text
          x={polar(START_ANGLE, RADIUS).x}
          y={polar(START_ANGLE, RADIUS).y + 22}
          textAnchor="middle"
          fontSize={10}
          fill="var(--muted)"
        >
          {min}
        </text>
        <text
          x={polar(END_ANGLE, RADIUS).x}
          y={polar(END_ANGLE, RADIUS).y + 22}
          textAnchor="middle"
          fontSize={10}
          fill="var(--muted)"
        >
          {max}
        </text>
      </svg>

      <figcaption className="-mt-2 flex flex-col items-center gap-1.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {grade}
        </span>
        <span className="tabular text-xs text-ink-2">
          95% CI {num(lower, 1)} – {num(upper, 1)}
        </span>
        {cohortMean !== undefined && (
          <span className="text-[11px] text-muted">
            Tick marks cohort mean ({num(cohortMean, 1)})
          </span>
        )}
      </figcaption>
    </figure>
  );
}
