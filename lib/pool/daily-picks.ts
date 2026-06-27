// Daily pick'em — knockout prediction storage (the prisma half). The pure decode /
// encode / merge / lock logic lives in lib/games/daily-pickem/picks.ts and is
// re-exported here; this file only adds the DB upsert (mirrors how md3-picks wraps
// the pure md3 helpers with prisma). Keeping the scoring/registry path off prisma
// means it never transitively loads lib/db / the env schema.

import { prisma } from "@/lib/db";
import { knockoutDailyFixtures } from "@/lib/games/daily-pickem/fixtures";
import { DAILY_KNOCKOUT_SECTION } from "@/lib/games/daily-pickem/scope";
import {
  decodeDailyKnockoutScores,
  mergeDailyKnockoutScores,
  dailyKnockoutRowsFor,
  type DailyKnockoutScores,
} from "@/lib/games/daily-pickem/picks";
import type { Results } from "@/lib/scoring/types";

export {
  decodeDailyKnockoutByTeam,
  decodeDailyKnockoutScores,
  dailyKnockoutRowsFor,
  mergeDailyKnockoutScores,
  isDailyKnockoutLocked,
  type ScoreLine,
  type DailyKnockoutScores,
} from "@/lib/games/daily-pickem/picks";

export interface UpsertDailyKnockoutInput {
  entryId: string;
  // The official results, to resolve fixtures + orientation.
  results: Results;
  // matchNo → predicted knockout scoreline. May be partial; only valid, unlocked,
  // open fixtures are written.
  scores: DailyKnockoutScores;
}

export interface UpsertDailyKnockoutResult {
  entryId: string;
  written: number; // knockout fixtures actually saved
}

// Save a daily entry's knockout predictions onto its existing Match Day Pickem
// entry, alongside its match_day_3 group rows (left untouched). Replaces only the
// daily_knockout rows. Per-match lock via mergeDailyKnockoutScores. Idempotent.
export async function upsertDailyKnockoutPicks(
  input: UpsertDailyKnockoutInput,
  now: Date = new Date(),
): Promise<UpsertDailyKnockoutResult> {
  const fixtures = knockoutDailyFixtures(input.results);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pick.findMany({
      where: { entryId: input.entryId, section: DAILY_KNOCKOUT_SECTION },
      select: { section: true, category: true, key: true, code: true, teamOrValue: true },
    });
    const current = decodeDailyKnockoutScores(existing, fixtures);
    const merged = mergeDailyKnockoutScores(current, input.scores, fixtures, now);
    const rows = dailyKnockoutRowsFor(merged, fixtures);

    // Replace only the daily_knockout rows — group rows (match_day_3) stay as-is.
    await tx.pick.deleteMany({ where: { entryId: input.entryId, section: DAILY_KNOCKOUT_SECTION } });
    if (rows.length > 0) {
      await tx.pick.createMany({ data: rows.map((r) => ({ ...r, entryId: input.entryId })) });
    }

    return { entryId: input.entryId, written: Object.keys(merged).length };
  });
}
