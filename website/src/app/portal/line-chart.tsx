import { compact } from "./state";

/**
 * The console's one line chart: pure SVG, no chart library, safe to render
 * on the server. Smooth polyline (Catmull-Rom via cubic beziers), low-opacity
 * area fill, subtle horizontal grid, compact y-axis ticks, day-number x-axis.
 * Handles zero data (flat baseline) and large values (nice y-axis rounding).
 */

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 14, bottom: 30, left: 52 };
const TICKS = 4;

export type ChartPoint = { label: string; value: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Round the y maximum up to a "nice" number (1/2/5 times a power of ten) so
// the four horizontal grid lines land on readable tick values.
function niceScale(max: number): { max: number; step: number } {
  if (max <= 0) return { max: TICKS, step: 1 };
  const rough = max / TICKS;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const frac = rough / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return { max: nice * base * TICKS, step: nice * base };
}

export default function LineChart({
  points,
  gradientId,
  ariaLabel,
}: {
  points: ChartPoint[];
  gradientId: string;
  ariaLabel: string;
}) {
  const n = points.length;
  const { max: yMax, step } = niceScale(Math.max(...points.map((p) => p.value), 0));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;

  const x = (i: number): number =>
    n <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW;
  const y = (v: number): number => PAD.top + plotH * (1 - v / yMax);

  const pts = points.map((p, i) => ({ x: x(i), y: y(p.value) }));

  let line: string;
  if (pts.length < 3) {
    line = pts.map((p, i) => `${i ? "L" : "M"}${round2(p.x)} ${round2(p.y)}`).join(" ");
  } else {
    line = `M${round2(pts[0].x)} ${round2(pts[0].y)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      // Control points clamped to the plot so spikes never overshoot the frame.
      const c1y = clamp(p1.y + (p2.y - p0.y) / 6, PAD.top, baseY);
      const c2y = clamp(p2.y - (p3.y - p1.y) / 6, PAD.top, baseY);
      line += ` C${round2(p1.x + (p2.x - p0.x) / 6)} ${round2(c1y)}, ${round2(
        p2.x - (p3.x - p1.x) / 6,
      )} ${round2(c2y)}, ${round2(p2.x)} ${round2(p2.y)}`;
    }
  }

  const area =
    pts.length > 1
      ? `${line} L${round2(pts[pts.length - 1].x)} ${round2(baseY)} L${round2(
          pts[0].x,
        )} ${round2(baseY)} Z`
      : "";

  // Roughly six x labels regardless of range, plus always the newest day.
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid lines + y-axis ticks */}
      {[0, 1, 2, 3, 4].map((i) => {
        const value = step * i;
        const gy = round2(y(value));
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={gy}
              x2={WIDTH - PAD.right}
              y2={gy}
              stroke={i === 0 ? "var(--line-2)" : "var(--line)"}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={gy + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--faint)"
              className="mono"
            >
              {compact(value)}
            </text>
          </g>
        );
      })}

      {area && <path d={area} fill={`url(#${gradientId})`} />}

      <path
        d={line}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* point marks */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={round2(p.x)}
          cy={round2(p.y)}
          r={n === 1 ? 3 : 2.2}
          fill="var(--paper-2)"
          stroke="var(--ink)"
          strokeWidth="1.2"
        />
      ))}

      {/* x-axis labels: day numbers */}
      {points.map((p, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <text
            key={i}
            x={round2(x(i))}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--faint)"
            className="mono"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
