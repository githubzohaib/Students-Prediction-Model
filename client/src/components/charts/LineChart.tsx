import { useMemo, useRef, useState } from "react";

import { num } from "../../lib/format";
import {
  ChartTooltip, GridLines, TableFallback, TooltipRow, TooltipTitle,
  XAxisLabels, YAxisLabels, niceTicks, useMeasuredWidth, usePointer,
} from "./primitives";
import type { TooltipState } from "./primitives";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
  /** Optional band drawn behind the line (e.g. an interquartile range). */
  band?: { x: number; lower: number; upper: number }[];
}

interface LineChartProps {
  series: LineSeries[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  /** Vertical reference line, e.g. the student's current value. */
  marker?: { x: number; label: string };
  yDomain?: [number, number];
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  tableCaption?: string;
}

const MARGIN = { top: 16, right: 18, bottom: 34, left: 46 };

export function LineChart({
  series, height = 240, xLabel, yLabel, marker, yDomain,
  formatX, formatY, tableCaption,
}: LineChartProps) {
  const { ref, width } = useMeasuredWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const chartWidth = Math.max(width, 280);
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const domain = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const bandYs = series.flatMap(
      (s) => s.band?.flatMap((b) => [b.lower, b.upper]) ?? [],
    );
    const allYs = [...ys, ...bandYs];

    if (!xs.length || !allYs.length) {
      return { x0: 0, x1: 1, y0: 0, y1: 1 };
    }

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    let yMin = yDomain ? yDomain[0] : Math.min(...allYs);
    let yMax = yDomain ? yDomain[1] : Math.max(...allYs);

    if (!yDomain) {
      // Pad so the line never sits on the frame.
      const pad = (yMax - yMin) * 0.12 || 1;
      yMin -= pad;
      yMax += pad;
    }

    return {
      x0: xMin,
      x1: xMax === xMin ? xMin + 1 : xMax,
      y0: yMin,
      y1: yMax === yMin ? yMin + 1 : yMax,
    };
  }, [series, yDomain]);

  const scaleX = (value: number) =>
    MARGIN.left + ((value - domain.x0) / (domain.x1 - domain.x0)) * innerWidth;

  const scaleY = (value: number) =>
    MARGIN.top + innerHeight - ((value - domain.y0) / (domain.y1 - domain.y0)) * innerHeight;

  const yTicks = niceTicks(domain.y0, domain.y1, 4);
  const xTicks = niceTicks(domain.x0, domain.x1, 5);

  const pointer = usePointer(svgRef, (point) => {
    if (!point || !series.length) {
      setTooltip(null);
      return;
    }

    // Snap to the nearest x across the first series.
    const primary = series[0];
    if (!primary.points.length) return;

    let nearest = primary.points[0];
    let nearestIndex = 0;
    let bestDistance = Infinity;

    primary.points.forEach((candidate, index) => {
      const distance = Math.abs(scaleX(candidate.x) - point.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = candidate;
        nearestIndex = index;
      }
    });

    setTooltip({
      x: scaleX(nearest.x),
      y: scaleY(nearest.y),
      content: (
        <>
          <TooltipTitle>
            {xLabel ? `${xLabel}: ` : ""}
            {formatX ? formatX(nearest.x) : num(nearest.x, 1)}
          </TooltipTitle>
          {series.map((s) => {
            const match = s.points[nearestIndex] ?? s.points.find((p) => p.x === nearest.x);
            if (!match) return null;
            return (
              <TooltipRow
                key={s.key}
                label={s.label}
                color={s.color}
                value={formatY ? formatY(match.y) : num(match.y, 2)}
              />
            );
          })}
        </>
      ),
    });
  });

  const linePath = (points: { x: number; y: number }[]) =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x)} ${scaleY(point.y)}`)
      .join(" ");

  const bandPath = (band: { x: number; lower: number; upper: number }[]) => {
    const upper = band.map((b) => `${scaleX(b.x)} ${scaleY(b.upper)}`);
    const lower = [...band].reverse().map((b) => `${scaleX(b.x)} ${scaleY(b.lower)}`);
    return `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
  };

  return (
    <div>
      <div ref={ref} className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={tableCaption ?? "Line chart"}
          {...pointer}
        >
          <GridLines ticks={yTicks} x0={MARGIN.left} x1={chartWidth - MARGIN.right} scale={scaleY} />

          {/* Baseline */}
          <line
            x1={MARGIN.left}
            x2={chartWidth - MARGIN.right}
            y1={MARGIN.top + innerHeight}
            y2={MARGIN.top + innerHeight}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          <YAxisLabels ticks={yTicks} x={MARGIN.left - 8} scale={scaleY} format={formatY} />
          <XAxisLabels
            ticks={xTicks}
            y={height - MARGIN.bottom + 16}
            scale={scaleX}
            format={formatX}
          />

          {/* Bands behind lines */}
          {series.map((s) =>
            s.band?.length ? (
              <path key={`${s.key}-band`} d={bandPath(s.band)} fill={s.color} opacity={0.14} />
            ) : null,
          )}

          {/* Reference marker */}
          {marker && marker.x >= domain.x0 && marker.x <= domain.x1 && (
            <g>
              <line
                x1={scaleX(marker.x)}
                x2={scaleX(marker.x)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="var(--ink-2)"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <text
                x={scaleX(marker.x)}
                y={MARGIN.top - 4}
                textAnchor="middle"
                fontSize={10}
                fill="var(--ink-2)"
              >
                {marker.label}
              </text>
            </g>
          )}

          {series.map((s) => (
            <path
              key={s.key}
              d={linePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
          ))}

          {/* Crosshair + focus dot */}
          {tooltip && (
            <g aria-hidden>
              <line
                x1={tooltip.x}
                x2={tooltip.x}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="var(--baseline)"
                strokeWidth={1}
              />
              <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r={5}
                fill={series[0]?.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}

          {yLabel && (
            <text
              transform={`rotate(-90) translate(${-(MARGIN.top + innerHeight / 2)} 12)`}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted)"
            >
              {yLabel}
            </text>
          )}
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

      {tableCaption && series.length > 0 && (
        <TableFallback
          caption={tableCaption}
          headers={[xLabel ?? "x", ...series.map((s) => s.label)]}
          rows={series[0].points.map((point, index) => [
            formatX ? formatX(point.x) : num(point.x, 2),
            ...series.map((s) =>
              s.points[index] ? num(s.points[index].y, 2) : "—",
            ),
          ])}
        />
      )}
    </div>
  );
}
