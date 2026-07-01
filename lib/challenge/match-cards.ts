// Pure helper turning a set of resolved MatchInput[] into the three inputs the
// shared ScoreCards component wants (live / last / next). Used by the public
// challenge Home pages, which have no pool but reuse the pool's live match cards
// (MD3 → the 24 final group matches; Knockout → matches 73+). DB-free so it's
// unit-testable; the caller fetches the inputs via getTournamentMatchInputs.

import {
  buildMatchCenter,
  type MatchInput,
  type MatchCenterRow,
  type MatchStatus,
  type YourScore,
} from "@/lib/pool/match-center";
import { selectNextMatch, type HomeNextMatch } from "@/lib/pool/home";
import { matchdaysAhead } from "@/lib/tz";
import { venueFor } from "@/lib/scoring/schedule";
import { TEAMS } from "@/lib/scoring/data";

export interface ScoreCardInputs {
  live: MatchCenterRow[];
  last: MatchCenterRow | null;
  next: HomeNextMatch | null;
}

const teamName = (code: string | null): string => (code && TEAMS[code]) || "TBD";

// A match counts as decided (for next-match selection and the "last" card) once
// the answer key or feed records a winner or a FINAL result.
function isDecided(m: MatchInput): boolean {
  return Boolean(m.winnerCode) || m.resultStatus === "FINAL";
}

// A live feed occasionally gets stuck: a Result row stays LIVE because the poll
// that flips it to FINAL was missed. A match can't still be in play this long
// after kickoff (90' + half-time + stoppage + extra time + penalties, with
// buffer), so past this window we treat a lingering LIVE as over — it drops off
// the "Live now" rail and becomes the most-recent-result card instead.
const STALE_LIVE_MS = 4 * 60 * 60 * 1000;

function isStaleLive(
  scheduledAt: Date | string | null | undefined,
  status: MatchStatus | null | undefined,
  now: Date,
): boolean {
  if (status !== "LIVE" || !scheduledAt) return false;
  const kickoff = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : scheduledAt.getTime();
  return Number.isFinite(kickoff) && now.getTime() - kickoff > STALE_LIVE_MS;
}

export function buildScoreCardInputs(
  inputs: MatchInput[],
  yourKnockoutPicks: Record<number, string> = {},
  now: Date = new Date(),
  scorePicks: Record<number, YourScore> = {},
): ScoreCardInputs {
  const rows = buildMatchCenter(inputs, yourKnockoutPicks, scorePicks).flatMap((s) => s.matches);

  // Genuinely-live matches only — a LIVE row that's implausibly old (stuck feed)
  // is excluded so a finished game never lingers on the "Live now" rail.
  const live = rows.filter((r) => r.status === "LIVE" && !isStaleLive(r.scheduledAt, r.status, now));

  // Most recently played match: the latest-scheduled FINAL (mirrors the pool's
  // "most recently finalised" card without needing a Result.updatedAt column).
  // Stuck-LIVE matches are treated as final here so their last-known score still
  // shows as the recent result rather than a phantom live card.
  const staleFinals = rows
    .filter((r) => isStaleLive(r.scheduledAt, r.status, now))
    .map((r) => ({ ...r, status: "FINAL" as const }));
  const finals = [...rows.filter((r) => r.status === "FINAL"), ...staleFinals].sort((a, b) =>
    (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""),
  );
  const last = finals[0] ?? null;

  const picked = selectNextMatch(
    inputs.map((m) => ({
      matchNo: m.matchNo,
      roundCode: m.roundCode,
      scheduledAt: m.scheduledAt,
      // A stuck-LIVE match is over for selection purposes, so it can't be picked
      // as the "next" match by the no-upcoming fallback.
      scored: isDecided(m) || isStaleLive(m.scheduledAt, m.resultStatus, now),
    })),
    now,
  );

  let next: HomeNextMatch | null = null;
  if (picked) {
    const full = inputs.find((m) => m.matchNo === picked.matchNo);
    const code = yourKnockoutPicks[picked.matchNo];
    const v = venueFor(picked.matchNo);
    next = {
      matchNo: picked.matchNo,
      roundCode: picked.roundCode,
      scheduledAt: picked.scheduledAt ? picked.scheduledAt.toISOString() : null,
      home: full?.homeCode ?? null,
      away: full?.awayCode ?? null,
      yourPick: code ? { code, name: teamName(code) } : null,
      venue: v?.venue ?? full?.venue ?? null,
      city: v?.city ?? full?.city ?? null,
      cityToken: v?.cityToken ?? full?.cityToken ?? null,
      odds: full?.odds ?? null,
      daysAhead: picked.scheduledAt ? Math.max(0, matchdaysAhead(picked.scheduledAt, now)) : 0,
    };
  }

  return { live, last, next };
}
