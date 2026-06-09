import type { BracketView, BracketMatch } from "@/lib/pool/bracket-view";
import { Flag } from "./Flag";

// Each knockout round gets a host-city tint so the bracket reads as a chromatic
// sweep from group-stage green through royal blue, purple, magenta, to gold.
const ROUND_ACCENT: Record<string, string> = {
  "Round of 32": "var(--round-r32)",
  "Round of 16": "var(--round-r16)",
  "Quarter-finals": "var(--round-qf)",
  "Semi-finals": "var(--round-sf)",
  "Third-place play-off": "var(--gold-dark)",
  Final: "var(--round-final)",
};

// A–L → host-city slug (color + matching subtle pattern motif).
const GROUP_CITY: Record<string, string> = {
  A: "mexico-city",
  B: "vancouver",
  C: "atlanta",
  D: "houston",
  E: "philadelphia",
  F: "los-angeles",
  G: "guadalajara",
  H: "kansas-city",
  I: "monterrey",
  J: "san-francisco",
  K: "boston",
  L: "new-york-nj",
};

function Side({
  name,
  code,
  score,
  isWinner,
  decided,
}: {
  name: string;
  code: string | null;
  score: number | null;
  isWinner: boolean;
  decided: boolean;
}) {
  const dimmed = decided && !isWinner;
  return (
    <div className={`flex items-center gap-2.5 py-1 ${dimmed ? "text-ink-4" : "text-ink"}`}>
      <Flag code={code} size={20} />
      <span className={`flex-1 truncate ${isWinner ? "font-bold" : "font-medium"}`}>
        {name}
        {code ? (
          <span className={`ml-1.5 font-mono text-[10px] ${dimmed ? "text-ink-4" : "text-ink-3"}`}>
            {code}
          </span>
        ) : null}
      </span>
      {score !== null ? (
        <span className="font-mono text-base font-bold tabular-nums">{score}</span>
      ) : null}
    </div>
  );
}

function MatchCard({ m, accent }: { m: BracketMatch; accent: string }) {
  const decided = Boolean(m.winnerCode);
  return (
    <div
      className="rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-ink-3">M{m.matchNo}</span>
        {decided ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        ) : null}
      </div>
      <Side
        name={m.home}
        code={m.homeCode}
        score={m.homeScore}
        isWinner={decided && m.winnerCode === m.homeCode}
        decided={decided}
      />
      <div className="my-0.5 h-px bg-line-soft" />
      <Side
        name={m.away}
        code={m.awayCode}
        score={m.awayScore}
        isWinner={decided && m.winnerCode === m.awayCode}
        decided={decided}
      />
    </div>
  );
}

export function Bracket({ view }: { view: BracketView }) {
  return (
    <div className="space-y-5">
      {view.rounds.map((round) => {
        const accent = ROUND_ACCENT[round.label] ?? "var(--line)";
        return (
          <div key={round.label}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
              {round.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {round.matches.map((m) => (
                <MatchCard key={m.matchNo} m={m} accent={accent} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GroupStandings({ view }: { view: BracketView }) {
  const anySet = view.groups.some((g) => g.first || g.second) || view.thirds.length > 0;
  if (!anySet) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
        Group standings will appear here once the group stage is decided.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.groups.map((g) => {
          const city = GROUP_CITY[g.group] ?? "mexico-city";
          return (
            <div
              key={g.group}
              className="relative overflow-hidden rounded-xl border border-line bg-surface p-3 text-sm"
            >
              <span
                className="pattern"
                data-pattern={city}
                style={{ color: `var(--city-${city})` }}
              />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm font-display text-[13px] text-white"
                    style={{
                      background: `var(--city-${city})`,
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    }}
                  >
                    {g.group}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                    Group {g.group}
                  </span>
                </div>
                <p className="mt-2">
                  <span className="font-mono text-ink-4">1.</span>{" "}
                  <span className="font-medium text-ink">{g.first ?? "—"}</span>
                </p>
                <p>
                  <span className="font-mono text-ink-4">2.</span>{" "}
                  <span className="font-medium text-ink">{g.second ?? "—"}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {view.thirds.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Third-place advancers
          </p>
          <p className="mt-1.5 font-medium text-ink">{view.thirds.join(" · ")}</p>
        </div>
      ) : null}
    </div>
  );
}
