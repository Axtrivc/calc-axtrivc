/**
 * Build-time SVG line chart for the analytical layer.
 *
 * A deliberate counterpoint to the interactive widgets: these charts render
 * once at build time from the page's own math library — they are static,
 * zero-JavaScript, print-friendly evidence, not live UI. Server Component
 * only; every value arrives precomputed.
 */

export type ChartSeries = {
  label: string;
  /** Stroke color (hex) — keep to the site palette. */
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
  /** Second tone used for the area fill under the line, if any. */
  fillTo?: number;
};

/** Pick "nice" tick values covering [min, max] with roughly `count` stops. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) {
    ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  }
  return ticks;
}

export default function ComparisonChart({
  series,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
  height = 300,
  caption,
  marker,
  yMinMode = 'zero',
}: {
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  xFormat: (n: number) => string;
  yFormat: (n: number) => string;
  height?: number;
  caption?: string;
  /** Optional vertical reference line at an x value, with its own label. */
  marker?: { x: number; label: string };
  /** 'zero' anchors the y-axis at 0 (default); 'auto' includes negatives. */
  yMinMode?: 'zero' | 'auto';
}) {
  const W = 720;
  const H = height;
  const M = { top: 18, right: 18, bottom: 40, left: 64 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  // Finance deltas anchor at zero when it's in range (honest baseline); when a
  // chart passes yMin:'auto' or all values are negative, scale from the data.
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const yMin = yMinMode === 'auto' ? Math.min(0, dataMin) : 0;
  const yMax = Math.max(dataMax * 1.04, 0) || 1;

  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin || 1)) * iw;
  const sy = (y: number) => M.top + ih - ((y - yMin) / (yMax - yMin || 1)) * ih;
  const crossesZero = yMin < 0 && yMax > 0;

  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 4);

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  return (
    <figure className="card m-0 overflow-hidden p-5 sm:p-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${yLabel} versus ${xLabel}. ${series.map((s) => `${s.label}: ${s.points.length} points`).join('; ')}.`}
      >
        {/* Grid + y axis */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="currentColor"
              className={crossesZero && Math.abs(t) < 1e-9 ? 'text-slate-400 dark:text-white/25' : 'text-slate-200 dark:text-white/10'}
              strokeWidth={crossesZero && Math.abs(t) < 1e-9 ? 1.5 : 1}
            />
            <text
              x={M.left - 8}
              y={sy(t) + 3.5}
              textAnchor="end"
              className="fill-slate-400 font-mono dark:fill-slate-500"
              fontSize="10"
            >
              {yFormat(t)}
            </text>
          </g>
        ))}
        {/* x axis ticks */}
        {xTicks.map((t) => (
          <text
            key={`x-${t}`}
            x={sx(t)}
            y={H - M.bottom + 16}
            textAnchor="middle"
            className="fill-slate-400 font-mono dark:fill-slate-500"
            fontSize="10"
          >
            {xFormat(t)}
          </text>
        ))}
        {/* axis titles */}
        <text
          x={M.left}
          y={12}
          className="fill-slate-400 dark:fill-slate-500"
          fontSize="9.5"
        >
          {yLabel}
        </text>
        <text
          x={W - M.right}
          y={H - 4}
          textAnchor="end"
          className="fill-slate-400 dark:fill-slate-500"
          fontSize="9.5"
        >
          {xLabel}
        </text>

        {/* Optional vertical reference marker */}
        {marker && marker.x > xMin && marker.x < xMax && (
          <g>
            <line
              x1={sx(marker.x)}
              x2={sx(marker.x)}
              y1={M.top}
              y2={M.top + ih}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={sx(marker.x) + 6}
              y={M.top + 10}
              className="fill-amber-600 font-mono dark:fill-amber-400"
              fontSize="9.5"
            >
              {marker.label}
            </text>
          </g>
        )}

        {/* Series */}
        {series.map((s) => (
          <g key={s.label}>
            {s.fillTo !== undefined && (
              <path
                d={`${path(s.points)} L${sx(s.points[s.points.length - 1].x).toFixed(1)},${sy(s.fillTo).toFixed(1)} L${sx(s.points[0].x).toFixed(1)},${sy(s.fillTo).toFixed(1)} Z`}
                fill={s.color}
                opacity="0.07"
              />
            )}
            <path
              d={path(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
            />
          </g>
        ))}
      </svg>

      {/* Legend + caption (HTML, not SVG, for text selection & a11y) */}
      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-4 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
        {caption && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{caption}</p>
        )}
      </figcaption>
    </figure>
  );
}
