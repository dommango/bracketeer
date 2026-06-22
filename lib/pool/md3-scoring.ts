// Match Day 3 Pickem scoring. Unlike the full-bracket/knockout path (which scores
// stored picks against the tournament answer key via the parity oracle), MD3
// scores each predicted scoreline against the LIVE per-match Result rows — the
// same rows the sports poller fills. Predictions and results are aligned by team
// code, not column position, so a poller home/away orientation that differs from
// the canonical draw orientation can't mis-score a pick.

import type { Prisma } from "@/generated/prisma/client";
import { md3Fixtures, MD3_MATCH_NOS, scoreMd3, type ScoreLine } from "@/lib/pool/match-day-3";

type Db = Prisma.TransactionClient;

interface Md3Result {
  matchNo: number;
  byTeam: Record<string, number>; // teamCode → goals
}

// Load FINAL MD3 results for a tournament, keyed by matchNo, as {teamCode: goals}.
async function loadMd3Results(tx: Db, tournamentId: string): Promise<Map<number, Md3Result>> {
  const rows = await tx.result.findMany({
    where: {
      status: "FINAL",
      match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } },
    },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      match: { select: { matchNo: true } },
    },
  });
  const out = new Map<number, Md3Result>();
  for (const r of rows) {
    if (
      !r.homeTeamCode ||
      !r.awayTeamCode ||
      r.homeScore === null ||
      r.awayScore === null
    )
      continue;
    out.set(r.match.matchNo, {
      matchNo: r.match.matchNo,
      byTeam: { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore },
    });
  }
  return out;
}

// Decode an entry's MD3 pick rows into { matchNo: { teamCode: goals } }.
function decodePickRows(
  picks: { section: string; category: string; key: string; code: string; teamOrValue: string }[],
): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  for (const p of picks) {
    if (p.section !== "match_day_3") continue;
    const matchNo = Number(p.category.replace(/^M/, ""));
    if (!Number.isInteger(matchNo)) continue;
    const goals = Number(p.teamOrValue);
    if (!Number.isFinite(goals) || !p.code) continue;
    const cur = out.get(matchNo) ?? {};
    cur[p.code] = Math.trunc(goals);
    out.set(matchNo, cur);
  }
  return out;
}

// Score every entry in an MD3 pool against the live results and upsert each
// ScoreBreakdown. Shares the leaderboard/snapshot path in recomputePool.
export async function scoreMd3Pool(tx: Db, poolId: string, tournamentId: string): Promise<void> {
  const results = await loadMd3Results(tx, tournamentId);
  const fixtures = md3Fixtures();

  const entries = await tx.entry.findMany({
    where: { poolId },
    select: {
      id: true,
      picks: {
        select: { section: true, category: true, key: true, code: true, teamOrValue: true },
      },
    },
  });

  for (const entry of entries) {
    const byMatch = decodePickRows(entry.picks);
    let total = 0;
    const perPick: Record<string, number> = {};

    for (const f of fixtures) {
      const result = results.get(f.matchNo);
      if (!result) continue; // not final yet — unscored
      const pred = byMatch.get(f.matchNo);
      if (!pred) continue; // no prediction made

      // Orient both to the fixture's canonical home/away by team code.
      const predLine: ScoreLine = { home: pred[f.homeCode] ?? 0, away: pred[f.awayCode] ?? 0 };
      const hasHome = f.homeCode in pred;
      const hasAway = f.awayCode in pred;
      if (!hasHome || !hasAway) continue; // incomplete pick row pair

      const actualLine: ScoreLine = {
        home: result.byTeam[f.homeCode] ?? 0,
        away: result.byTeam[f.awayCode] ?? 0,
      };
      const points = scoreMd3(predLine, actualLine);
      total += points;
      perPick[`M${f.matchNo}`] = points;
    }

    await tx.scoreBreakdown.upsert({
      where: { entryId: entry.id },
      update: { totalPoints: total, byCategory: { md3: total }, perPick, computedAt: new Date() },
      create: { entryId: entry.id, totalPoints: total, byCategory: { md3: total }, perPick },
    });
  }
}
