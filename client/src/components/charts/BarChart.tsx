import { useRef, useState } from "react";

import { num } from "../../lib/format";
import {
  ChartTooltip, GridLines, TableFallback, TooltipRow, TooltipTitle,
  YAxisLabels, niceTicks, useMeasuredWidth,
} from "./primitives";
import type { TooltipState } from "./primitives";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
  /** Secondary line shown in the tooltip. */
  note?: string;
}

/* ------------------------------------------------------- Horizontal bars */

export function HorizontalBars({
  data, formatValue, showValues = true, tableCaption, valueLabel = "Value",
}: {
  data: BarDatum[];
  formatValue?: (value: number) => string;
  showValues?: boolean;
  tableCaption?: string;
  valueLabel?: string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1e-9);
  const format = formatValue ?? ((value: number) => num(value, 2));

  return (
    <div>
      <ul className="flex flex-col gap-2.5">
        {data.map((datum) => {
          const ratio = Math.abs(datum.value) / max;
          return (
            <li key={datum.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-ink">{datum.label}</span>
                {showValues && (
                  <span className="tabular shrink-0 text-xs font-medium text-ink">
                    {format(datum.value)}
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(ratio * 100, datum.value === 0 ? 0 : 1.5)}%`,
                    backgroundColor: datum.color ?? "var(--series-1)",
                  }}
                />
              </div>
              {datum.note && (
                <p className="mt-1 text-[11px] text-muted">{datum.note}</p>
              )}
            </li>
          );
        })}
      </ul>

      {tableCaption && (
        <TableFallback
          caption={tableCaption}
          headers={["Item", valueLabel]}
          rows={data.map((d) => [d.label, format(d.value)])}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------- Vertical bars */

const MARGIN = { top: 16, right: 14, bottom: 42, left: 44 };

export function VerticalBars({
  data, height = 220, formatValue, yLabel, xLabel, tableCaption, rotateLabels,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (value: number) => string;
  yLabel?: string;
  xLabel?: string;
  tableCaption?: string;
  rotateLabels?: boolean;
}) {
  const { ref, width } = useMeasuredWidth();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const max = Math.max(...data.map((d) => d.value), 0);
  const yMax = max === 0 ? 1 : max * 1.1;
  const yTicks = niceTicks(0, yMax, 4);
  const format = formatValue ?? ((value: number) => num(value, 0));

  const scaleY = (value: number) =>
    MARGIN.top + innerHeight - (value / yMax) * innerHeight;

  // A 2px surface gap between adjacent bars.
  const slot = innerWidth / Math.max(data.length, 1);
  const barWidth = Math.max(slot - 2, 1);

  return (
    <div>
      <div ref={ref} className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={tableCaption ?? "Bar chart"}
        >
          <GridLines
            ticks={yTicks}
            x0={MARGIN.left}
            x1={chartWidth - MARGIN.right}
            scale={scaleY}
          />
          <YAxisLabels
            ticks={yTicks}
            x={MARGIN.left - 8}
            scale={scaleY}
            format={format}
          />

          <line
            x1={MARGIN.left}
            x2={chartWidth - MARGIN.right}
            y1={MARGIN.top + innerHeight}
            y2={MARGIN.top + innerHeight}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          {data.map((datum, index) => {
            const x = MARGIN.left + index * slot + 1;
            const y = scaleY(datum.value);
            const barHeight = Math.max(MARGIN.top + innerHeight - y, datum.value > 0 ? 2 : 0);

            return (
              <g key={datum.key}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(4, barWidth / 2)}
                  fill={datum.color ?? "var(--series-1)"}
                  onPointerEnter={() =>
                    setTooltip({
                      x: x + barWidth / 2,
                      y,
                      content: (
                        <>
                          <TooltipTitle>{datum.label}</TooltipTitle>
                          <TooltipRow
                            label={yLabel ?? "Value"}
                            value={format(datum.value)}
                            color={datum.color ?? "var(--series-1)"}
                          />
                          {datum.note && (
                            <p className="mt-1 text-[11px] text-muted">{datum.note}</p>
                          )}
                        </>
                      ),
                    })
                  }
                  onPointerLeave={() => setTooltip(null)}
                />
              </g>
            );
          })}

          {/* Axis labels; thinned out when bars are narrow. */}
          {data.map((datum, index) => {
            const every = Math.ceil(data.length / Math.max(Math.floor(innerWidth / 44), 1));
            if (index % every !== 0) return null;

            const cx = MARGIN.left + index * slot + slot / 2;
            return (
              <text
                key={`${datum.key}-label`}
                x={cx}
                y={MARGIN.top + innerHeight + 14}
                textAnchor={rotateLabels ? "end" : "middle"}
                transform={rotateLabels ? `rotate(-35 ${cx} ${MARGIN.top + innerHeight + 14})` : undefined}
                fontSize={10}
                fill="var(--muted)"
              >
                {datum.label}
              </text>
            );
          })}

          {xLabel && (
            <text
              x={MARGIN.left + innerWidth / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted)"
            >
              {xLabel}
            </text>
          )}
        </svg>

        <ChartTooltip tooltip={tooltip} width={chartWidth} />
      </div>

      {tableCaption && (
        <TableFallback
          caption={tableCaption}
          headers={[xLabel ?? "Category", yLabel ?? "Value"]}
          rows={data.map((d) => [d.label, format(d.value)])}
        />
      )}
    </div>
  );
}
