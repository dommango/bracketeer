import Link from "next/link";
import type { MatchCenterRow } from "@/lib/pool/match-center";
import type { HomeNextMatch } from "@/lib/pool/home";
import { Flag } from "./Flag";
import { TEAMS } from "@/lib/scoring/data";
import { formatKickoff } from "@/lib/pool/format";

const ROUND_ACCENT: Record<string, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--round-r32)",
  R16: "var(--round-r16)",
  QF: "var(--round-qf)",
  SF: "var(--round-sf)",
  BRONZE: "var(--gold-dark)",
  FINAL: "var(--round-final)",
};

const ROUND_LABEL: Record<string, string> = {
  GROUP: "Group stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  BRONZE: "Third place",
  FINAL: "Final",
};

const teamName = (code: string | null): string =>
  (code && TEAMS[code as keyof typeof TEAMS]) || "TBD";

const CARD_CLASS =
  "block rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch";

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
      Live
    </span>
  );
}

function TeamRow({
  code,
  name,
  score,
  bold,
}: {
  code: string | null;
  name: string;
  score: number | null;
  bold: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Flag code={code} size={24} />
      <span className={`flex-1 truncate ${bold ? "font-bold text-ink" : "font-medium text-ink-2"}`}>
        {name}
        {code ? <span className="ml-1.5 font-mono text-[10px] text-ink-3">{code}</span> : null}
      </span>
      {score !== null ? (
        <span className="font-mono text-2xl font-bold tabular-nums text-ink">{score}</span>
      ) : null}
    </div>
  );
}

function LiveOrFinalCard({ row, code }: { row: MatchCenterRow; code: string }) {
  const accent = ROUND_ACCENT[row.roundCode] ?? "var(--line)";
  const decided = row.status === "FINAL" && Boolean(row.winnerCode);
  const homeWins = decided ? row.winnerCode === row.home.code : (row.home.score ?? 0) >= (row.away.score ?? 0);
  const awayWins = decided ? row.winnerCode === row.away.code : (row.away.score ?? 0) > (row.home.score ?? 0);
  return (
    <Link href={`/pool/${code}/matches/${row.matchNo}`} className={CARD_CLASS} style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          {ROUND_LABEL[row.roundCode] ?? row.roundCode}
        </span>
        {row.status === "LIVE" ? (
          <LiveBadge />
        ) : (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        )}
      </div>
      <TeamRow code={row.home.code} name={row.home.name} score={row.home.score} bold={homeWins} />
      <div className="my-0.5 h-px bg-line-soft" />
      <TeamRow code={row.away.code} name={row.away.name} score={row.away.score} bold={awayWins} />
      {row.yourPick ? (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-pitch-dark">
            Your pick: {row.yourPick.name}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

function NextMatchCard({ match, code }: { match: HomeNextMatch; code: string }) {
  const accent = ROUND_ACCENT[match.roundCode] ?? "var(--line)";
  return (
    <Link href={`/pool/${code}/matches/${match.matchNo}`} className={CARD_CLASS} style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          {ROUND_LABEL[match.roundCode] ?? match.roundCode}
        </span>
        <span className="font-mono text-xs text-ink-3">
          {match.scheduledAt ? formatKickoff(match.scheduledAt) : "TBD"}
        </span>
      </div>
      <TeamRow code={match.home} name={teamName(match.home)} score={null} bold={false} />
      <div className="my-0.5 h-px bg-line-soft" />
      <TeamRow code={match.away} name={teamName(match.away)} score={null} bold={false} />
      {match.yourPick ? (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-pitch-dark">
            Your pick: {match.yourPick.name}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

// Card-count rule (avoids 3-card awkwardness on a 2-col desktop grid):
//   ≥2 live → show live only
//   1 live  → live + next
//   0 live  → last + next
export function ScoreCards({
  live,
  last,
  next,
  code,
}: {
  live: MatchCenterRow[];
  last: MatchCenterRow | null;
  next: HomeNextMatch | null;
  code: string;
}) {
  type Card = { key: string; node: React.ReactNode };
  const cards: Card[] = [];

  if (live.length >= 2) {
    for (const row of live) {
      cards.push({ key: `live-${row.matchNo}`, node: <LiveOrFinalCard row={row} code={code} /> });
    }
  } else if (live.length === 1) {
    cards.push({ key: `live-${live[0].matchNo}`, node: <LiveOrFinalCard row={live[0]} code={code} /> });
    if (next) cards.push({ key: `next-${next.matchNo}`, node: <NextMatchCard match={next} code={code} /> });
  } else {
    if (last) cards.push({ key: `last-${last.matchNo}`, node: <LiveOrFinalCard row={last} code={code} /> });
    if (next) cards.push({ key: `next-${next.matchNo}`, node: <NextMatchCard match={next} code={code} /> });
  }

  if (cards.length === 0) return null;

  return (
    <section aria-live="polite" aria-label="Matches">
      {live.length > 0 ? (
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-1.5 w-1.5 rounded-full bg-live [animation:live-pulse_1.4s_ease-out_infinite]" />
          Live now
        </h2>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map(({ key, node }) => (
          <div key={key}>{node}</div>
        ))}
      </div>
    </section>
  );
}
