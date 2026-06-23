// Match Day 3 Pickem challenge entry service. MD3 is challenge-only: a signed-in
// player predicts the 24 final group-stage scores directly in the public Match Day
// 3 challenge — there's no pool and no private/opt-in step. Entering your
// predictions IS being in the challenge. The predictions live on a standalone
// Entry (poolId null, MATCH_DAY_3_PICKEM, enteredChallenge true), are scored
// against live results, and surface on the public board once all 24 are in.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import {
  getStandaloneMd3Entry,
  upsertStandaloneMd3Picks,
  type Md3Scores,
} from "@/lib/pool/md3-picks";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { isMd3EntryComplete } from "@/lib/challenge/eligibility";
import { recomputeEntry } from "@/lib/pool/scoring";

export interface Md3ChallengeEntry {
  entryId: string;
  label: string;
  scores: Md3Scores;
  // Whether every one of the 24 fixtures has a predicted scoreline — the board's
  // eligibility signal (an incomplete entry is saved but not yet shown publicly).
  complete: boolean;
  // Cached score against live results (0 until fixtures go final). Display-only.
  total: number;
}

// The signed-in user's MD3 challenge entry for a tournament, or null if they
// haven't started predicting yet.
export async function getMyMd3Entry(
  userId: string,
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<Md3ChallengeEntry | null> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  const entry = await getStandaloneMd3Entry(tournamentId, userId);
  if (!entry) return null;

  const meta = await prisma.entry.findUnique({
    where: { id: entry.entryId },
    select: { breakdown: { select: { totalPoints: true } } },
  });

  return {
    entryId: entry.entryId,
    label: entry.label,
    scores: entry.scores,
    complete: isMd3EntryComplete(entry.scores),
    total: meta?.breakdown?.totalPoints ?? 0,
  };
}

export interface SaveMd3PredictionsInput {
  userId: string;
  label: string;
  // matchNo → predicted scoreline. May be partial; locked fixtures are ignored.
  scores: Md3Scores;
  tournamentSlug?: string;
}

// Create or update the user's MD3 challenge predictions. The entry is marked
// entered on save (MD3 is challenge-only — there's no private mode), then
// recomputed so its cached score is fresh. Gated on the game still being open
// (at least one fixture unlocked).
export async function saveMyMd3Predictions(input: SaveMd3PredictionsInput): Promise<{ entryId: string }> {
  if (!isMd3GameOpen()) {
    throw new Error("Match Day 3 is locked — every fixture has kicked off.");
  }
  const tournamentId = await getTournamentIdBySlug(input.tournamentSlug ?? DEFAULT_TOURNAMENT_SLUG);

  const res = await upsertStandaloneMd3Picks({
    tournamentId,
    userId: input.userId,
    label: input.label,
    scores: input.scores,
  });

  // Entering predictions is entering the challenge — mark it so the entry is on the
  // board as soon as it's complete (idempotent; no opt-in toggle).
  await prisma.entry.update({ where: { id: res.entryId }, data: { enteredChallenge: true } });
  await recomputeEntry(res.entryId);
  return { entryId: res.entryId };
}
