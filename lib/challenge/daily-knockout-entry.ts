// Knockout Match Day Pick'em entry service — the write side of the free knockout
// game. It reuses the player's standalone MATCH_DAY_3_PICKEM entry (the same one
// the group leg used, or a fresh one for players who join in the knockout phase)
// and stores knockout scorelines in the daily_knockout Pick section via
// upsertDailyKnockoutPicks. Unlike the group leg this carries NO prize, so there's
// no consent gate — entering is simply opting into the public knockout board.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asResults } from "@/lib/pool/scoring";
import { ensureStandaloneMd3Entry } from "@/lib/pool/md3-picks";
import { upsertDailyKnockoutPicks } from "@/lib/pool/daily-picks";
import { hasDailyKnockoutPicks } from "@/lib/pool/daily-knockout-view";
import { isDailyKnockoutGameOpen } from "@/lib/games/daily-pickem/schedule";
import { recomputeEntry } from "@/lib/pool/scoring";
import type { DailyKnockoutScores } from "@/lib/games/daily-pickem/picks";

export interface SaveDailyKnockoutInput {
  userId: string;
  label: string;
  // matchNo → predicted knockout scoreline. May be partial; only valid, unlocked,
  // seated fixtures are written (locked fixtures keep their stored value).
  scores: DailyKnockoutScores;
  tournamentSlug?: string;
}

// Create or update the user's knockout predictions on their standalone entry, then
// recompute so the cached knockout subtotal (breakdown.byCategory.daily) is fresh.
// Gated on the game still being open (the Final hasn't kicked off).
export async function saveMyDailyKnockoutPredictions(
  input: SaveDailyKnockoutInput,
): Promise<{ entryId: string }> {
  if (!isDailyKnockoutGameOpen()) {
    throw new Error("The knockout pick'em is locked — the Final has kicked off.");
  }
  const tournamentId = await getTournamentIdBySlug(input.tournamentSlug ?? DEFAULT_TOURNAMENT_SLUG);

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  const results = asResults(tournament.officialResults);

  const { entryId } = await ensureStandaloneMd3Entry(tournamentId, input.userId, input.label);
  await upsertDailyKnockoutPicks({ entryId, results, scores: input.scores });
  await recomputeEntry(entryId);
  return { entryId };
}

// Whether a user has skin in the knockout game — at least one saved knockout
// prediction. The leaderboard is gated to participants. False for signed-out
// viewers.
export async function isDailyKnockoutParticipant(
  userId: string | null,
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<boolean> {
  if (!userId) return false;
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  return hasDailyKnockoutPicks(tournamentId, userId);
}
