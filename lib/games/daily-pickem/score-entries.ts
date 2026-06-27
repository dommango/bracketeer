// DB-bound daily knockout scoring. Analogous to computeMd3Breakdowns (group), this
// scores each entry's daily_knockout pick rows against the LIVE knockout Result
// rows, additively. It is ADDED on top of the group score — an entry with no
// daily_knockout rows (every existing Match Day Pickem entry) scores 0 here with an
// empty perPick, so its overall breakdown is byte-identical to before. Orientation
// is by team code (poller home/away can't mis-score), exactly like the group path.

import type { Prisma } from "@/generated/prisma/client";
import { knockoutDailyFixtures } from "./fixtures";
import { scoreDailyKnockout } from "./score-knockout";
import { DAILY_KNOCKOUT_MATCH_NOS } from "./scope";
import { decodeDailyKnockoutByTeam } from "./picks";
import { computeMd3Breakdowns } from "@/lib/pool/md3-scoring";
import type { ScorableGameEntry, ScoringContext, ScoredEntry } from "@/lib/games/types";

type Db = Prisma.TransactionClient;

interface KnockoutResult {
  byTeam: Record<string, number>; // teamCode → goals (the displayed score line)
}

// Load FINAL knockout Result rows for a tournament, keyed by matchNo as
// {teamCode: goals}. Same select/shape as loadMd3Results, different match numbers.
async function loadKnockoutResults(tx: Db, tournamentId: string): Promise<Map<number, KnockoutResult>> {
  const rows = await tx.result.findMany({
    where: {
      status: "FINAL",
      match: { tournamentId, matchNo: { in: [...DAILY_KNOCKOUT_MATCH_NOS] } },
    },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      match: { select: { matchNo: true } },
    },
  });
  const out = new Map<number, KnockoutResult>();
  for (const r of rows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    out.set(r.match.matchNo, { byTeam: { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore } });
  }
  return out;
}

export interface DailyKnockoutBreakdown {
  entryId: string;
  total: number;
  perPick: Record<string, number>;
}

// Score the daily_knockout rows for a set of entries. Returns a per-entry total +
// perPick keyed by `M{matchNo}`. Early-returns all-zero before any knockout result
// is FINAL (the common case until the Round of 32 kicks off), so the live group
// game pays only one empty query.
export async function computeDailyKnockout(
  tx: Db,
  entries: ScorableGameEntry[],
  ctx: ScoringContext,
): Promise<DailyKnockoutBreakdown[]> {
  const results = await loadKnockoutResults(tx, ctx.tournamentId);
  if (results.size === 0) {
    return entries.map((e) => ({ entryId: e.id, total: 0, perPick: {} }));
  }

  const fixtures = new Map(knockoutDailyFixtures(ctx.answer).map((f) => [f.matchNo, f]));

  const out: DailyKnockoutBreakdown[] = [];
  for (const entry of entries) {
    const byMatch = decodeDailyKnockoutByTeam(entry.picks);
    let total = 0;
    const perPick: Record<string, number> = {};

    for (const matchNo of DAILY_KNOCKOUT_MATCH_NOS) {
      const result = results.get(matchNo);
      if (!result) continue; // not final yet
      const fixture = fixtures.get(matchNo);
      if (!fixture || !fixture.homeCode || !fixture.awayCode) continue; // competitors unknown
      const pred = byMatch.get(matchNo);
      if (!pred) continue; // no prediction
      if (!(fixture.homeCode in pred) || !(fixture.awayCode in pred)) continue; // incomplete

      const actual = {
        home: result.byTeam[fixture.homeCode] ?? 0,
        away: result.byTeam[fixture.awayCode] ?? 0,
      };
      const { points } = scoreDailyKnockout({
        predByTeam: pred,
        homeCode: fixture.homeCode,
        awayCode: fixture.awayCode,
        actual,
        winnerCode: ctx.answer.knockout?.[matchNo] ?? null,
      });
      total += points;
      perPick[`M${matchNo}`] = points;
    }

    out.push({ entryId: entry.id, total, perPick });
  }
  return out;
}

// The full daily breakdown for a set of MATCH_DAY_3_PICKEM entries: the group score
// (computeMd3Breakdowns, unchanged) PLUS the knockout score, merged into one
// ScoredEntry. An entry with no daily_knockout rows gets back its group ScoredEntry
// untouched — byte-identical totalPoints / byCategory / perPick to before the daily
// extension — so existing Match Day Pickem standings never change. Entries that DO
// carry knockout picks get their knockout points summed into totalPoints, their
// knockout per-pick merged into perPick (group M-nos ≤72 and knockout ≥73 never
// collide), and an additive `daily` total on byCategory.
export async function computeDailyBreakdowns(
  tx: Db,
  entries: ScorableGameEntry[],
  ctx: ScoringContext,
): Promise<ScoredEntry[]> {
  const group = await computeMd3Breakdowns(tx, entries, ctx.tournamentId);
  const knockout = await computeDailyKnockout(tx, entries, ctx);
  const koById = new Map(knockout.map((k) => [k.entryId, k]));

  return group.map((g) => {
    const k = koById.get(g.entryId);
    // No knockout contribution → return the group ScoredEntry verbatim.
    if (!k || (k.total === 0 && Object.keys(k.perPick).length === 0)) return g;
    const perPick = { ...(g.perPick ?? {}), ...k.perPick };
    const byCategory = { ...(g.byCategory as Record<string, unknown>), daily: k.total };
    return { entryId: g.entryId, totalPoints: g.totalPoints + k.total, byCategory, perPick };
  });
}
