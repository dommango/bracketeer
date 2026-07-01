import type { ImpliedProbs } from "@/lib/odds/map";
import { resolvePair, DRAW_FILL } from "@/lib/teams/colors";
import { UpdatedAt } from "./UpdatedAt";

const pct = (x: number) => Math.round(x * 100);

// The home/away segments are tinted with the colors of the teams playing (draw
// stays neutral grey). When codes are absent the bar falls back to brand tokens.
// Pass `fetchedAt` to stamp the bar with an "Updated …" freshness label (used on
// the roomy match-detail surfaces; inline card bars omit it to stay compact).
export function WinProbBar({
  odds,
  homeCode,
  awayCode,
  fetchedAt,
}: {
  odds: ImpliedProbs | null;
  homeCode?: string | null;
  awayCode?: string | null;
  fetchedAt?: Date | null;
}) {
  if (!odds) return null;
  const h = pct(odds.homeWinProb);
  const d = pct(odds.drawProb);
  const a = 100 - h - d;

  const hasCodes = Boolean(homeCode || awayCode);
  const { home, away } = hasCodes
    ? resolvePair(homeCode, awayCode)
    : { home: "var(--pitch)", away: "var(--round-r16)" };
  // Draw share is a textured gray fill. Order is home · draw · away — draw middle.
  const drawFill = hasCodes ? DRAW_FILL : "var(--ink-4)";

  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <span style={{ width: `${h}%`, background: home }} />
        <span style={{ width: `${d}%`, background: drawFill }} />
        <span style={{ width: `${a}%`, background: away }} />
      </div>
      {/* Percentages read in ink for legibility (team colors can be too pale to
          meet contrast as text); the colored bar above carries the team identity. */}
      <div className="mt-0.5 flex justify-between text-[10px] font-mono">
        <span className="font-semibold text-ink-2">{h}%</span>
        <span className="text-ink-3">D {d}%</span>
        <span className="font-semibold text-ink-2">{a}%</span>
      </div>
      {fetchedAt ? (
        <div className="mt-1">
          <UpdatedAt date={fetchedAt} />
        </div>
      ) : null}
    </div>
  );
}
