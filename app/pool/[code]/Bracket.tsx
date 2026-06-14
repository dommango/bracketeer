import type { BracketView, BracketMatch, BracketRound } from "@/lib/pool/bracket-view";
import type { GroupTableRow } from "@/lib/pool/group-table";
import { R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { formatMatchDate, formatKickoff } from "@/lib/pool/format";
import { Flag } from "./Flag";

// Pre-order DFS from the Final (a-branch before b-branch) gives every knockout
// match a top-to-bottom position so its two feeders sit directly beside it —
// the backbone of the desktop bracket tree. Leaves (R32) have no feeders.
const FEEDERS: Record<number, [number, number]> = Object.fromEntries(
  [...R16, ...QF, ...SF, FINAL].map((m) => [m.id, [m.a, m.b]]),
);
const TREE_ORDER: Record<number, number> = (() => {
  const order: Record<number, number> = {};
  let next = 0;
  const visit = (id: number) => {
    order[id] = next++;
    const feeders = FEEDERS[id];
    if (feeders) {
      visit(feeders[0]);
      visit(feeders[1]);
    }
  };
  visit(FINAL.id);
  return order;
})();

const BRONZE_LABEL = "Third-place play-off";

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
        {m.tag ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
            {m.tag}
          </span>
        ) : <span />}
        {m.live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-live-tint px-2 py-0.5 font-mono text-[10px] font-bold text-live">
            <span className="h-[5px] w-[5px] rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
            Live
          </span>
        ) : decided ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        ) : m.scheduledAt ? (
          <span className="font-mono text-[10px] text-ink-3">{formatKickoff(m.scheduledAt)}</span>
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

function RoundHeading({ label, accent }: { label: string; accent: string }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.08em] text-ink-2">
      <span className="h-2.5 w-2.5 rounded" style={{ background: accent }} />
      {label}
    </h3>
  );
}

// Mobile / tablet: rounds stacked vertically, two MatchCards per row.
function BracketStack({ rounds }: { rounds: BracketRound[] }) {
  return (
    <div className="space-y-5">
      {rounds.map((round) => {
        const accent = ROUND_ACCENT[round.label] ?? "var(--line)";
        return (
          <div key={round.label}>
            <div className="mb-2">
              <RoundHeading label={round.label} accent={accent} />
            </div>
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

// Desktop: a true horizontal bracket tree. The third-place play-off lives off
// the main tree (it pairs the two semi-final losers), so it renders separately.
function BracketTree({ rounds, bronze }: { rounds: BracketRound[]; bronze?: BracketMatch }) {
  const treeRounds = rounds.filter((r) => r.label !== BRONZE_LABEL);
  return (
    <div className="relative left-1/2 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1040px]">
          {treeRounds.map((round) => (
            <div key={round.label} className="min-w-[200px] flex-1 px-5">
              <RoundHeading label={round.label} accent={ROUND_ACCENT[round.label] ?? "var(--line)"} />
            </div>
          ))}
        </div>

        <div className="mt-2 flex min-w-[1040px]">
          {treeRounds.map((round) => {
            const accent = ROUND_ACCENT[round.label] ?? "var(--line)";
            const ordered = [...round.matches].sort(
              (a, b) => (TREE_ORDER[a.matchNo] ?? 0) - (TREE_ORDER[b.matchNo] ?? 0),
            );
            return (
              <div key={round.label} className="bkt-round flex min-w-[200px] flex-1 flex-col">
                {ordered.map((m) => (
                  <div key={m.matchNo} className="bkt-cell flex items-center px-5">
                    <div className="w-full">
                      <MatchCard m={m} accent={accent} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {bronze ? (
        <div className="mx-auto mt-6 max-w-sm">
          <div className="mb-2">
            <RoundHeading label={BRONZE_LABEL} accent="var(--gold-dark)" />
          </div>
          <MatchCard m={bronze} accent="var(--gold-dark)" />
        </div>
      ) : null}
    </div>
  );
}

export function Bracket({ view }: { view: BracketView }) {
  const bronze = view.rounds.find((r) => r.label === BRONZE_LABEL)?.matches[0];
  return (
    <>
      <div className="lg:hidden">
        <BracketStack rounds={view.rounds} />
      </div>
      <div className="hidden lg:block">
        <BracketTree rounds={view.rounds} bronze={bronze} />
      </div>
    </>
  );
}

export function GroupStandings({ view }: { view: BracketView }) {
  // Tables are always populated (all 4 teams, 0–0 before play), so every group
  // renders the same full-size table; the empty state only shows pre-seed.
  const anySet = view.groups.some((g) => g.table.length > 0) || view.thirds.length > 0;
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
              className="relative overflow-hidden rounded-xl border border-line p-3 text-sm"
              style={{ background: `color-mix(in srgb, var(--city-${city}) 7%, var(--surface))` }}
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
                  {!g.started && g.firstMatchAt ? (
                    <span className="ml-auto font-mono text-[10px] font-medium text-ink-3">
                      {formatMatchDate(g.firstMatchAt)}
                    </span>
                  ) : null}
                </div>
                {g.table.length > 0 ? (
                  <table className="mt-2 w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="text-ink-4">
                        <th className="text-left font-medium">#</th>
                        <th className="text-left font-medium">Team</th>
                        <th className="text-right font-medium">P</th>
                        <th className="text-right font-medium">GD</th>
                        <th className="text-right font-medium">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.table.map((r: GroupTableRow) => {
                        const advancing = r.rank <= 2;
                        const isThird = r.rank === 3;
                        return (
                          <tr
                            key={r.code}
                            className={
                              advancing
                                ? "font-bold text-ink"
                                : isThird
                                  ? "text-ink-2"
                                  : "text-ink-4"
                            }
                          >
                            <td className="py-0.5 text-left font-mono">{r.rank}</td>
                            <td className="py-0.5 text-left">
                              {r.code}
                              {r.tied && g.started ? <span className="ml-1 text-ink-4">=</span> : null}
                            </td>
                            <td className="py-0.5 text-right tabular-nums">{r.played}</td>
                            <td className="py-0.5 text-right tabular-nums">
                              {r.gd > 0 ? `+${r.gd}` : r.gd}
                            </td>
                            <td className="py-0.5 text-right font-mono tabular-nums">{r.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <p className="mt-2">
                      <span className="font-mono text-ink-4">1.</span>{" "}
                      <span className="font-medium text-ink">{g.first ?? "—"}</span>
                    </p>
                    <p>
                      <span className="font-mono text-ink-4">2.</span>{" "}
                      <span className="font-medium text-ink">{g.second ?? "—"}</span>
                    </p>
                  </>
                )}
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
