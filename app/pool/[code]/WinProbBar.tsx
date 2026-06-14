type Probs = { homeWinProb: number; drawProb: number; awayWinProb: number };
const pct = (x: number) => Math.round(x * 100);

export function WinProbBar({ odds }: { odds: Probs | null }) {
  if (!odds) return null;
  const h = pct(odds.homeWinProb), d = pct(odds.drawProb), a = pct(odds.awayWinProb);
  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <span style={{ width: `${h}%`, background: "var(--pitch)" }} />
        <span style={{ width: `${d}%`, background: "var(--ink-4)" }} />
        <span style={{ width: `${a}%`, background: "var(--round-r16)" }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] font-mono text-ink-3">
        <span>{h}%</span><span>D {d}%</span><span>{a}%</span>
      </div>
    </div>
  );
}
