import type { ImpliedProbs } from "@/lib/odds/map";

const pct = (x: number) => Math.round(x * 100);

export function WinProbBar({ odds }: { odds: ImpliedProbs | null }) {
  if (!odds) return null;
  const h = pct(odds.homeWinProb);
  const d = pct(odds.drawProb);
  const a = 100 - h - d;
  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <span style={{ width: `${h}%`, background: "var(--pitch)" }} />
        <span style={{ width: `${d}%`, background: "var(--ink-4)" }} />
        <span style={{ width: `${a}%`, background: "var(--round-r16)" }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] font-mono">
        <span style={{ color: "var(--pitch)" }}>{h}%</span>
        <span style={{ color: "var(--ink-4)" }}>D {d}%</span>
        <span style={{ color: "var(--round-r16)" }}>{a}%</span>
      </div>
    </div>
  );
}
