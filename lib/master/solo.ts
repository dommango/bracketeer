// Solo bracket service: a signed-in player builds their own knockout bracket
// without creating or joining a friend-group pool. The bracket is a single
// Entry living in the master pool (lib/master/pool.ts); it is scored and visible
// only to its owner until they opt in (enteredMaster), which surfaces it on the
// public master leaderboard. Reuses the same pick storage, validation, locking,
// and scoring as the pool flow — solo and pool brackets are byte-identical.

import { prisma } from "@/lib/db";
import { getOrCreateMasterPool } from "@/lib/master/pool";
import { getKnockoutState } from "@/lib/pool/queries";
import { upsertUiEntry, getUserEntry } from "@/lib/pool/submit-picks";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { knockoutOnlyPicks, isKnockoutLocked } from "@/lib/pool/knockout";
import { validatePicks, inconsistentKnockoutPicks } from "@/lib/pool/pick-form";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import type { Picks } from "@/lib/scoring/types";

export interface SoloBracket {
  entryId: string;
  label: string;
  tiebreak: string;
  picks: Picks;
  locked: boolean;
  // Whether this bracket has been entered into the public master tournament.
  enteredMaster: boolean;
  // Cached official score (0 until results land). Display-only.
  total: number;
}

// The signed-in user's solo bracket for a tournament, or null if they haven't
// built one yet. Looks only in the master pool, where every solo entry lives.
export async function getSoloBracket(
  userId: string,
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<SoloBracket | null> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  const poolId = await getOrCreateMasterPool(tournamentId);

  const decoded = await getUserEntry(poolId, userId);
  if (!decoded) return null;

  const meta = await prisma.entry.findUnique({
    where: { id: decoded.entryId },
    select: { enteredMaster: true, breakdown: { select: { totalPoints: true } } },
  });

  return {
    entryId: decoded.entryId,
    label: decoded.label,
    tiebreak: decoded.tiebreak,
    picks: decoded.picks,
    locked: decoded.locked,
    enteredMaster: meta?.enteredMaster ?? false,
    total: meta?.breakdown?.totalPoints ?? 0,
  };
}

export interface SaveSoloInput {
  userId: string;
  label: string;
  tiebreak: string;
  picks: Picks;
  tournamentSlug?: string;
}

export interface SaveSoloResult {
  entryId: string;
  replaced: boolean;
}

// Create or update the user's solo knockout bracket. Mirrors the knockout branch
// of submitPicksAction: gate on the field being set and not yet locked, strip to
// knockout + awards, reject winners not in the official seed, then persist and
// recompute. The membership check the pool flow does is intentionally absent —
// solo brackets need no pool membership.
export async function saveSoloBracket(input: SaveSoloInput): Promise<SaveSoloResult> {
  const tournamentId = await getTournamentIdBySlug(input.tournamentSlug ?? DEFAULT_TOURNAMENT_SLUG);
  const { open, locksAt, seed } = await getKnockoutState(tournamentId);
  if (!open) {
    throw new Error("Knockout picks aren't open yet — the last 32 aren't set.");
  }
  if (isKnockoutLocked(locksAt)) {
    throw new Error("Picks are locked — the Round of 32 has kicked off.");
  }

  // The client is untrusted: keep only knockout + awards, then verify every
  // winner is actually in its match per the official seed.
  const picks = knockoutOnlyPicks(input.picks);
  if (inconsistentKnockoutPicks(picks, seed).length > 0) {
    throw new Error("Some picks aren't valid for this bracket — please reload.");
  }
  const errors = validatePicks(picks);
  if (errors.length > 0) throw new Error(errors[0]);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });

  const poolId = await getOrCreateMasterPool(tournamentId);
  const existing = await getUserEntry(poolId, input.userId);

  const res = await upsertUiEntry({
    poolId,
    userId: input.userId,
    entryId: existing?.entryId,
    label: input.label,
    picks,
    email: user?.email,
    tiebreak: input.tiebreak,
  });

  await recomputePool(poolId);
  await notifyPool(poolId, "leaderboard");
  return res;
}

// Opt the user's solo bracket into (or out of) the public master tournament.
// Recomputes so the master leaderboard + snapshots reflect the change, and
// notifies the master pool's live streams. No-op (returns false) if the user has
// no solo bracket yet.
export async function setEnteredMaster(
  userId: string,
  entered: boolean,
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<boolean> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  const poolId = await getOrCreateMasterPool(tournamentId);

  const entry = await prisma.entry.findFirst({
    where: { poolId, userId },
    select: { id: true },
  });
  if (!entry) return false;

  await prisma.entry.update({
    where: { id: entry.id },
    data: { enteredMaster: entered },
  });
  await recomputePool(poolId);
  await notifyPool(poolId, "leaderboard");
  return true;
}
