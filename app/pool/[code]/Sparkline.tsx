import type { TrendPoint } from "@/lib/pool/movers";

// A dependency-free inline SVG sparkline of an entry's cumulative points over
// time. Server-rendered (no client JS). Needs at least two points to draw.
export function Sparkline({
  trend,
  width = 280,
  height = 56,
}: {
  trend: TrendPoint[];
  width?: number;
  height?: number;
}) {
  if (trend.length < 2) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-center text-sm text-ink-3">
        Trend appears once there are at least two scoring updates.
      </p>
    );
  }

  const pad = 4;
  const xs = trend.map((_, i) => (i / (trend.length - 1)) * (width - pad * 2) + pad);
  const max = Math.max(...trend.map((t) => t.totalPoints));
  const min = Math.min(...trend.map((t) => t.totalPoints));
  const span = max - min || 1;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const points = trend.map((t, i) => `${xs[i]},${y(t.totalPoints)}`);
  const line = points.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(" ");
  const area = `${line} L${xs[xs.length - 1]},${height - pad} L${xs[0]},${height - pad} Z`;
  const last = trend[trend.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Points trend, now at ${last.totalPoints}`}
    >
      <path d={area} fill="var(--pitch-tint)" />
      <path d={line} fill="none" stroke="var(--pitch)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={y(last.totalPoints)} r={3} fill="var(--pitch)" />
    </svg>
  );
}
