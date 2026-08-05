import { useState } from "react";

import { num } from "../../lib/format";
import { TableFallback } from "./primitives";

/**
 * Correlation matrix.
 *
 * Correlation is signed, so this uses the diverging blue↔red pair with a
 * neutral gray midpoint at zero. Every cell also carries its numeric value,
 * so colour is a scan aid rather than the only encoding.
 */
export function CorrelationHeatmap({
  labels, matrix,
}: {
  labels: string[];
  matrix: number[][];
}) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const cellColor = (value: number) => {
    const magnitude = Math.min(Math.abs(value), 1);
    if (magnitude < 0.02) return "var(--surface-2)";

    // Mix each pole toward the neutral midpoint by |r|.
    const pole = value > 0 ? "var(--series-1)" : "var(--critical)";
    return `color-mix(in srgb, ${pole} ${magnitude * 88}%, var(--surface-2))`;
  };

  // Keep text legible as the cell darkens.
  const textColor = (value: number) =>
    Math.abs(value) > 0.55 ? "#ffffff" : "var(--ink)";

  return (
    <div>
      <div className="chart-scroll">
        <table
          className="w-full min-w-[380px] border-separate"
          style={{ borderSpacing: 2 }}
        >
          <caption className="sr-only">
            Pearson correlation between every feature pair and the target.
          </caption>
          <thead>
            <tr>
              <th className="w-28" />
              {labels.map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-1 pb-2 text-[10px] font-medium ${
                    hover?.col === index ? "text-ink" : "text-muted"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={labels[rowIndex]}>
                <th
                  scope="row"
                  className={`pr-2 text-right text-[10px] font-medium ${
                    hover?.row === rowIndex ? "text-ink" : "text-muted"
                  }`}
                >
                  {labels[rowIndex]}
                </th>
                {row.map((value, colIndex) => (
                  <td
                    key={`${rowIndex}-${colIndex}`}
                    className="tabular h-11 rounded-sm text-center text-[11px] font-medium transition-transform"
                    style={{
                      backgroundColor: cellColor(value),
                      color: textColor(value),
                      outline:
                        hover?.row === rowIndex && hover?.col === colIndex
                          ? "2px solid var(--ink)"
                          : undefined,
                    }}
                    onPointerEnter={() => setHover({ row: rowIndex, col: colIndex })}
                    onPointerLeave={() => setHover(null)}
                    title={`${labels[rowIndex]} vs ${labels[colIndex]}: r = ${num(value, 3)}`}
                  >
                    {num(value, 2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[10px] text-muted">−1</span>
        <div
          className="h-2 w-40 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--critical), var(--surface-2), var(--series-1))",
          }}
          aria-hidden
        />
        <span className="text-[10px] text-muted">+1</span>
        <span className="ml-2 text-[10px] text-muted">Pearson r</span>
      </div>

      <TableFallback
        caption="Correlation matrix values"
        headers={["Pair", "r"]}
        rows={matrix.flatMap((row, i) =>
          row
            .map((value, j) => ({ value, i, j }))
            .filter(({ i: ri, j: rj }) => rj > ri)
            .map(({ value, i: ri, j: rj }) => [
              `${labels[ri]} × ${labels[rj]}`,
              num(value, 3),
            ]),
        )}
      />
    </div>
  );
}
