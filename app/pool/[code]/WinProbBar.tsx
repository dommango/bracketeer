import type { ImpliedProbs } from "@/lib/odds/map";
import { resolvePair, NEUTRAL } from "@/lib/teams/colors";

const pct = (x: number) => Math.round(x * 100);

// The home/away segments are tinted with the colors of the teams playing (draw
// stays neutral grey). When codes are absent the bar falls back to brand tokens.
export function WinProbBar({
  odds,
  homeCode,
  awayCode,
}: {
  odds: ImpliedProbs | null;
  homeCode?: string | null;
  awayCode?: string | null;
}) {
  if (!odds) return null;
  const h = pct(odds.homeWinProb);
  const d = pct(odds.drawProb);
  const a = 100 - h - d;

  const hasCodes = Boolean(homeCode || awayCode);
  const { home, away } = hasCodes
    ? resolvePair(homeCode, awayCode)
    : { home: "var(--pitch)", away: "var(--round-r16)" };
  const draw = hasCodes ? NEUTRAL : "var(--ink-4)";

  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <span style={{ width: `${h}%`, background: home }} />
        <span style={{ width: `${d}%`, background: draw }} />
        <span style={{ width: `${a}%`, background: away }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] font-mono">
        <span style={{ color: home }}>{h}%</span>
        <span style={{ color: draw }}>D {d}%</span>
        <span style={{ color: away }}>{a}%</span>
      </div>
    </div>
  );
}
