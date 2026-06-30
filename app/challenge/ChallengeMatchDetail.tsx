import Link from "next/link";
import type { MatchDetail } from "@/lib/pool/queries";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "@/app/pool/[code]/Flag";
import { TeamLink } from "@/app/pool/[code]/TeamLink";
import {
  MatchTimeline,
  MatchStatsBars,
  TeamScorers,
} from "@/app/pool/[code]/matches/[no]/MatchLive";
import { MatchInsights } from "@/app/pool/[code]/matches/[no]/MatchInsights";
import { MatchInjuries } from "@/app/pool/[code]/matches/[no]/MatchInjuries";
import { MatchLineups } from "@/app/pool/[code]/matches/[no]/MatchLineups";
import { MatchPlayerRatings } from "@/app/pool/[code]/matches/[no]/MatchPlayerRatings";
import { VenueLine } from "@/app/pool/[code]/VenueLine";
import { WinProbBar } from "@/app/pool/[code]/WinProbBar";
import { UpsetBadge } from "@/app/pool/[code]/UpsetBadge";
import { PickSplitCard, ConsensusCard } from "@/app/pool/[code]/matches/[no]/ConsensusCards";

// One match's detail view for the public challenges — the same rich content the
// pool match page shows (resolved teams, live status, timeline, scorers, stats,
// odds, insights, lineups, injuries, venue), minus the pool-only pieces
// (pick-split, what-if, chat). Tournament-scoped: team/venue rows drill down via
// the challenge `basePath` (`/challenge/md3` | `/challenge/knockout`) rather than
// a pool path. `backHref` returns to the challenge's Matches list.
function TeamRow({
  side,
  pens,
  isWinner,
  decided,
  basePath,
}: {
  side: MatchDetail["home"];
  pens: number | null;
  isWinner: boolean;
  decided: boolean;
  basePath: string;
}) {
  const dimmed = decided && !isWinner;
  return (
    <div className={`flex items-center gap-3 py-2 ${dimmed ? "text-ink-4" : "text-ink"}`}>
      <TeamLink basePath={basePath} code={side.code}>
        <Flag code={side.code} size={28} />
      </TeamLink>
      <TeamLink
        basePath={basePath}
        code={side.code}
        className={`flex-1 truncate text-lg underline-offset-2 hover:underline ${isWinner ? "font-bold" : "font-semibold"}`}
      >
        {side.name}
        {side.code ? <span className="ml-2 font-mono text-xs text-ink-3">{side.code}</span> : null}
      </TeamLink>
      {pens != null ? (
        <span className="font-mono text-xs font-semibold tabular-nums text-ink-3">({pens} pens)</span>
      ) : null}
      {side.score !== null ? (
        <span className="font-display text-2xl tabular-nums">{side.score}</span>
      ) : null}
    </div>
  );
}

// Over/Under total-goals market, shown under the win-probability bar once the
// totals line has been polled. Hidden entirely otherwise.
function TotalsLine({ totals }: { totals: MatchDetail["totals"] }) {
  if (!totals) return null;
  const over = Math.round(totals.overProb * 100);
  const under = Math.round(totals.underProb * 100);
  return (
    <p className="mt-2 text-xs text-ink-3">
      <span className="font-semibold text-ink-2">O/U {totals.line}</span>
      {" — Over "}
      {over}% · Under {under}%
    </p>
  );
}

// Asian-handicap (spreads) market, shown beside the Over/Under line once a spread
// has been polled. The line is home-oriented (negative = home favored), so the
// favored side is whichever the line points to; we surface the supremacy as
// "<favorite> -<line>" plus each side's implied cover %. Hidden when not polled.
function SpreadLine({
  spread,
  home,
  away,
}: {
  spread: MatchDetail["spread"];
  home: MatchDetail["home"];
  away: MatchDetail["away"];
}) {
  if (!spread || spread.line === 0) return null;
  const homeFavored = spread.line < 0;
  const favName = homeFavored ? home.name : away.name;
  const handicap = -Math.abs(spread.line); // always shown from the favorite's view
  const homePct = Math.round(spread.homeCoverProb * 100);
  const awayPct = Math.round(spread.awayCoverProb * 100);
  return (
    <p className="mt-1 text-xs text-ink-3">
      <span className="font-semibold text-ink-2">
        Spread {favName} {handicap}
      </span>
      {` — ${home.name} ${homePct}% · ${away.name} ${awayPct}%`}
    </p>
  );
}

// The viewer's Match Day Pickem scoreline for this fixture, shown beside the live
// or final score. `points` is null until the match is final, then green when the
// prediction scored, muted when it missed.
function YourPrediction({
  pick,
}: {
  pick: { home: number; away: number; points: number | null };
}) {
  const scored = pick.points !== null;
  const earned = scored && pick.points! > 0;
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface-sunk/50 px-3 py-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
        Your prediction
      </span>
      <span className="flex items-center gap-2">
        <span className="font-display text-lg tabular-nums text-ink">
          {pick.home}–{pick.away}
        </span>
        {scored ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              earned ? "bg-pitch-tint text-pitch-dark" : "bg-surface-sunk text-ink-3"
            }`}
          >
            +{pick.points}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function ChallengeMatchDetail({
  detail,
  backHref,
  basePath,
  yourScore = null,
}: {
  detail: MatchDetail;
  backHref: string;
  // The challenge root for drill-down links — "/challenge/md3" | "/challenge/knockout".
  basePath: string;
  // The viewer's MD3 scoreline prediction for this fixture, if any (MD3 only).
  yourScore?: { home: number; away: number; points: number | null } | null;
}) {
  const decided = detail.status === "FINAL" && Boolean(detail.winnerCode);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          {detail.roundLabel}
        </h2>
        <Link
          href={backHref}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← All matches
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-1 flex items-center gap-2">
          {detail.status === "LIVE" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
              {detail.elapsed != null ? `${detail.elapsed}'` : "Live"}
            </span>
          ) : detail.status === "FINAL" ? (
            <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Final
            </span>
          ) : (
            <span className="font-mono text-xs text-ink-3">
              {detail.scheduledAt ? formatKickoff(detail.scheduledAt) : "Kickoff time TBD"}
            </span>
          )}
          <UpsetBadge
            status={detail.status}
            homeScore={detail.home.score}
            awayScore={detail.away.score}
            odds={detail.odds}
          />
        </div>
        <TeamRow
          side={detail.home}
          pens={detail.homePens}
          isWinner={decided && detail.winnerCode === detail.home.code}
          decided={decided}
          basePath={basePath}
        />
        <TeamScorers timeline={detail.timeline} side="home" />
        <div className="h-px bg-line-soft" />
        <TeamRow
          side={detail.away}
          pens={detail.awayPens}
          isWinner={decided && detail.winnerCode === detail.away.code}
          decided={decided}
          basePath={basePath}
        />
        <TeamScorers timeline={detail.timeline} side="away" />
        <div className="mt-3">
          <VenueLine
            venue={detail.venue}
            city={detail.city}
            cityToken={detail.cityToken}
            basePath={basePath}
          />
        </div>
        <WinProbBar odds={detail.odds} homeCode={detail.home.code} awayCode={detail.away.code} fetchedAt={detail.oddsFetchedAt} />
        <TotalsLine totals={detail.totals} />
        <SpreadLine spread={detail.spread} home={detail.home} away={detail.away} />
        {yourScore ? <YourPrediction pick={yourScore} /> : null}
      </div>

      <MatchInsights prediction={detail.prediction} home={detail.home} away={detail.away} />
      <MatchInjuries injuries={detail.injuries} home={detail.home} away={detail.away} />
      <MatchLineups lineup={detail.lineup} home={detail.home} away={detail.away} />
      <MatchTimeline items={detail.timeline} />
      <MatchStatsBars bars={detail.stats} homeCode={detail.home.code} awayCode={detail.away.code} />
      <MatchPlayerRatings
        playerRatings={detail.playerRatings}
        playerOfMatch={detail.playerOfMatch}
        home={detail.home}
        away={detail.away}
      />

      {detail.scored && detail.pickSplit ? (
        <PickSplitCard split={detail.pickSplit} audience="field" />
      ) : null}
      {detail.scored && detail.pickSplit ? (
        <ConsensusCard
          prediction={detail.prediction}
          pickSplit={detail.pickSplit}
          home={detail.home}
          away={detail.away}
          audience="field"
        />
      ) : null}
    </section>
  );
}
