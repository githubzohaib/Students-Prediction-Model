import { useState } from "react";

import { num, signed } from "../../lib/format";
import {
  ChartTooltip, TableFallback, TooltipRow, TooltipTitle, useMeasuredWidth,
} from "./primitives";
import type { TooltipState } from "./primitives";

export interface WaterfallStep {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

const MARGIN = { top: 20, right: 16, bottom: 30, left: 130 };
const ROW_HEIGHT = 38;

/**
 * Shapley waterfall: starts at the model's baseline output and walks each
 * feature's contribution to reach the final prediction.
 *
 * Direction is encoded twice — position relative to the running total and a
 * signed value label — so the diverging colour is never the only cue.
 */
export function Waterfall({
  baseline, prediction, steps, unit = "pts",
}: {
  baseline: number;
  prediction: number;
  steps: WaterfallStep[];
  unit?: string;
}) {
  const { ref, width } = useMeasuredWidth();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const chartWidth = Math.max(width, 320);
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const height = MARGIN.top + MARGIN.bottom + (steps.length + 2) * ROW_HEIGHT;

  // Track the running total so each bar starts where the last one ended.
  let running = baseline;
  const bars = steps.map((step) => {
    const from = running;
    running += step.value;
    return { ...step, from, to: running };
  });

  const allValues = [baseline, prediction, ...bars.flatMap((b) => [b.from, b.to])];
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  const pad = (max - min) * 0.15 || 1;
  min -= pad;
  max += pad;

  const scaleX = (value: number) =>
    MARGIN.left + ((value - min) / (max - min)) * innerWidth;

  const rowY = (index: number) => MARGIN.top + index * ROW_HEIGHT;

  const anchorRow = (
    label: string,
    value: number,
    index: number,
    color: string,
  ) => (
    <g key={label}>
      <text
        x={MARGIN.left - 10}
        y={rowY(index) + ROW_HEIGHT / 2}
        dy="0.32em"
        textAnchor="end"
        fontSize={11}
        fontWeight={600}
        fill="var(--ink)"
      >
        {label}
      </text>
      <rect
        x={MARGIN.left}
        y={rowY(index) + ROW_HEIGHT / 2 - 5}
        width={Math.max(scaleX(value) - MARGIN.left, 2)}
        height={10}
        rx={4}
        fill={color}
        opacity={0.35}
      />
      <line
        x1={scaleX(value)}
        x2={scaleX(value)}
        y1={rowY(index) + 4}
        y2={rowY(index) + ROW_HEIGHT - 4}
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={scaleX(value) + 8}
        y={rowY(index) + ROW_HEIGHT / 2}
        dy="0.32em"
        className="tabular"
        fontSize={11}
        fontWeight={600}
        fill="var(--ink)"
      >
        {num(value, 1)}
      </text>
    </g>
  );

  return (
    <div>
      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={
            `Waterfall from a baseline of ${num(baseline, 1)} to a prediction of ` +
            `${num(prediction, 1)}, broken down by feature contribution.`
          }
        >
          {anchorRow("Baseline", baseline, 0, "var(--muted)")}

          {bars.map((bar, index) => {
            const rowIndex = index + 1;
            const y = rowY(rowIndex) + ROW_HEIGHT / 2 - 9;
            const x0 = scaleX(Math.min(bar.from, bar.to));
            const x1 = scaleX(Math.max(bar.from, bar.to));
            const barWidth = Math.max(x1 - x0, 2);
            const positive = bar.value > 0;

            // Diverging pair: blue for lift, red for drag, gray when inert.
            const color =
              Math.abs(bar.value) < 0.05
                ? "var(--baseline)"
                : positive
                  ? "var(--series-1)"
                  : "var(--critical)";

            return (
              <g key={bar.key}>
                <text
                  x={MARGIN.left - 10}
                  y={rowY(rowIndex) + ROW_HEIGHT / 2}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--ink-2)"
                >
                  {bar.label}
                </text>

                {/* Connector from the previous running total */}
                <line
                  x1={scaleX(bar.from)}
                  x2={scaleX(bar.from)}
                  y1={rowY(rowIndex) - ROW_HEIGHT / 2 + 9}
                  y2={y}
                  stroke="var(--grid)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />

                <rect
                  x={x0}
                  y={y}
                  width={barWidth}
                  height={18}
                  rx={4}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  onPointerEnter={() =>
                    setTooltip({
                      x: x0 + barWidth / 2,
                      y: y + 9,
                      content: (
                        <>
                          <TooltipTitle>{bar.label}</TooltipTitle>
                          <TooltipRow
                            label="Contribution"
                            value={`${signed(bar.value, 2)} ${unit}`}
                            color={color}
                          />
                          <TooltipRow label="Running total" value={num(bar.to, 2)} />
                          {bar.detail && (
                            <p className="mt-1 text-[11px] text-muted">{bar.detail}</p>
                          )}
                        </>
                      ),
                    })
                  }
                  onPointerLeave={() => setTooltip(null)}
                />

                <text
                  x={positive ? x1 + 8 : x0 - 8}
                  y={rowY(rowIndex) + ROW_HEIGHT / 2}
                  dy="0.32em"
                  textAnchor={positive ? "start" : "end"}
                  className="tabular"
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--ink)"
                >
                  {signed(bar.value, 2)}
                </text>
              </g>
            );
          })}

          {anchorRow("Prediction", prediction, bars.length + 1, "var(--series-1)")}
        </svg>

        <ChartTooltip tooltip={tooltip} width={chartWidth} />
      </div>

      <TableFallback
        caption="Shapley contribution breakdown"
        headers={["Step", `Contribution (${unit})`, "Running total"]}
        rows={[
          ["Baseline", "—", num(baseline, 2)],
          ...bars.map((bar) => [bar.label, signed(bar.value, 2), num(bar.to, 2)]),
          ["Prediction", "—", num(prediction, 2)],
        ]}
      />
    </div>
  );
}
