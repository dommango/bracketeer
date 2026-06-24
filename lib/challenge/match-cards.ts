// Pure helper turning a set of resolved MatchInput[] into the three inputs the
// shared ScoreCards component wants (live / last / next). Used by the public
// challenge Home pages, which have no pool but reuse the pool's live match cards
// (MD3 → the 24 final group matches; Knockout → matches 73+). DB-free so it's
// unit-testable; the caller fetches the inputs via getTournamentMatchInputs.

import {
  buildMatchCenter,
  type MatchInput,
  type MatchCenterRow,
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

export function buildScoreCardInputs(
  inputs: MatchInput[],
  yourKnockoutPicks: Record<number, string> = {},
  now: Date = new Date(),
): ScoreCardInputs {
  const rows = buildMatchCenter(inputs, yourKnockoutPicks).flatMap((s) => s.matches);

  const live = rows.filter((r) => r.status === "LIVE");

  // Most recently played match: the latest-scheduled FINAL (mirrors the pool's
  // "most recently finalised" card without needing a Result.updatedAt column).
  const finals = rows
    .filter((r) => r.status === "FINAL")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  const last = finals[0] ?? null;

  const picked = selectNextMatch(
    inputs.map((m) => ({
      matchNo: m.matchNo,
      roundCode: m.roundCode,
      scheduledAt: m.scheduledAt,
      scored: isDecided(m),
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
