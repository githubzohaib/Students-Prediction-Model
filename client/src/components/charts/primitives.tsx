import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Observes an element's width so SVG charts can lay out responsively. */
export function useMeasuredWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Floating tooltip anchored inside the chart's own bounding box. */
export function ChartTooltip({
  tooltip, width,
}: {
  tooltip: TooltipState | null;
  width: number;
}) {
  if (!tooltip) return null;

  // Flip to the left of the cursor when close to the right edge.
  const flip = tooltip.x > width - 150;

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-hairline bg-surface px-2.5 py-2 shadow-md"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
        maxWidth: 220,
      }}
    >
      {tooltip.content}
    </div>
  );
}

export function TooltipRow({
  label, value, color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="flex items-center gap-1.5 text-ink-2">
        {color && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        {label}
      </span>
      <span className="tabular font-medium text-ink">{value}</span>
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 border-b border-hairline pb-1 text-[11px] font-semibold text-ink">
      {children}
    </p>
  );
}

/* ---------------------------------------------------------- Axis pieces */

export function GridLines({
  ticks, x0, x1, scale,
}: {
  ticks: number[];
  x0: number;
  x1: number;
  scale: (value: number) => number;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <line
          key={tick}
          x1={x0}
          x2={x1}
          y1={scale(tick)}
          y2={scale(tick)}
          stroke="var(--grid)"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

export function YAxisLabels({
  ticks, x, scale, format,
}: {
  ticks: number[];
  x: number;
  scale: (value: number) => number;
  format?: (value: number) => string;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <text
          key={tick}
          x={x}
          y={scale(tick)}
          dy="0.32em"
          textAnchor="end"
          className="tabular"
          fontSize={10}
          fill="var(--muted)"
        >
          {format ? format(tick) : tick}
        </text>
      ))}
    </g>
  );
}

export function XAxisLabels({
  ticks, y, scale, format,
}: {
  ticks: number[];
  y: number;
  scale: (value: number) => number;
  format?: (value: number) => string;
}) {
  return (
    <g aria-hidden>
      {ticks.map((tick) => (
        <text
          key={tick}
          x={scale(tick)}
          y={y}
          textAnchor="middle"
          className="tabular"
          fontSize={10}
          fill="var(--muted)"
        >
          {format ? format(tick) : tick}
        </text>
      ))}
    </g>
  );
}

/** Evenly spaced "nice" tick values across a domain. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  const step =
    (normalised >= 5 ? 10 : normalised >= 2 ? 5 : normalised >= 1 ? 2 : 1) * magnitude;

  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];

  for (let value = start; value <= max + step * 1e-6; value += step) {
    // Guard against binary drift producing 39.99999999.
    ticks.push(Number(value.toPrecision(12)));
  }

  return ticks;
}

/** Escape hatch for keyboard users: every chart ships a table alternative. */
export function TableFallback({
  caption, headers, rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="mt-3"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none text-[11px] text-muted hover:text-ink-2">
        View as table
      </summary>
      <div className="scroll-x mt-2">
        <table className="w-full min-w-[320px] border-collapse text-[11px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border-b border-hairline px-2 py-1.5 text-left font-medium text-ink-2"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-b border-hairline px-2 py-1.5 text-ink"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Pointer position within an SVG, in SVG user units. */
export function usePointer(
  svgRef: React.RefObject<SVGSVGElement>,
  onMove: (point: { x: number; y: number } | null) => void,
) {
  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const viewWidth = svg.viewBox.baseVal.width || rect.width;
      const viewHeight = svg.viewBox.baseVal.height || rect.height;

      onMove({
        x: ((event.clientX - rect.left) / rect.width) * viewWidth,
        y: ((event.clientY - rect.top) / rect.height) * viewHeight,
      });
    },
    [onMove, svgRef],
  );

  const handleLeave = useCallback(() => onMove(null), [onMove]);

  useEffect(() => () => onMove(null), [onMove]);

  return { onPointerMove: handleMove, onPointerLeave: handleLeave };
}
