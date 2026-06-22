// Solo bracket service: a signed-in player builds their own knockout bracket
// without creating or joining a friend-group pool. The bracket is a standalone
// Entry (poolId null) carrying its own tournamentId + KNOCKOUT format; it is
// scored and visible only to its owner until they opt in (enteredChallenge),
// which surfaces it on the public Bracketeer Knockout Challenge leaderboard.
// Reuses the same pick storage, validation, locking, and scoring as the pool
// flow — solo and pool brackets are byte-identical.

import { prisma } from "@/lib/db";
import { getKnockoutState } from "@/lib/pool/queries";
import { upsertUiEntry, getStandaloneEntry } from "@/lib/pool/submit-picks";
import { recomputeEntry } from "@/lib/pool/scoring";
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
  // Whether this bracket has been entered into the public Knockout Challenge.
  enteredChallenge: boolean;
  // Cached official score (0 until results land). Display-only.
  total: number;
}

// The signed-in user's solo bracket for a tournament, or null if they haven't
// built one yet. A solo bracket is a standalone KNOCKOUT entry (poolId null).
export async function getSoloBracket(
  userId: string,
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<SoloBracket | null> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);

  const decoded = await getStandaloneEntry(tournamentId, userId, "KNOCKOUT");
  if (!decoded) return null;

  const meta = await prisma.entry.findUnique({
    where: { id: decoded.entryId },
    select: { enteredChallenge: true, breakdown: { select: { totalPoints: true } } },
  });

  return {
    entryId: decoded.entryId,
    label: decoded.label,
    tiebreak: decoded.tiebreak,
    picks: decoded.picks,
    locked: decoded.locked,
    enteredChallenge: meta?.enteredChallenge ?? false,
    total: meta?.breakdown?.totalPoints ?? 0,
  };
}

export interface SaveSoloInput {
  userId: string;
  // The standalone bracket to edit. Omit to create a NEW standalone bracket —
  // a user may keep several (each placed independently).
  entryId?: string | null;
  label: string;
  tiebreak: string;
  picks: Picks;
  tournamentSlug?: string;
}

export interface SaveSoloResult {
  entryId: string;
  replaced: boolean;
}

// Create or update a standalone knockout bracket. Mirrors the knockout branch of
// submitPicksAction: gate on the field being set and not yet locked, strip to
// knockout + awards, reject winners not in the official seed, then persist as a
// standalone entry (poolId null) and recompute it. With entryId it edits that
// bracket; without one it creates a new bracket. No pool membership.
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

  const res = await upsertUiEntry({
    poolId: null,
    tournamentId,
    format: "KNOCKOUT",
    userId: input.userId,
    entryId: input.entryId ?? undefined,
    forceCreate: !input.entryId,
    label: input.label,
    picks,
    email: user?.email,
    tiebreak: input.tiebreak,
  });

  await recomputeEntry(res.entryId);
  return res;
}

// Opt a solo bracket into (or out of) the public Knockout Challenge. Knockout-
// only — group brackets can't enter. Recomputes the entry so its cached score is
// fresh on the Challenge board. No-op (returns false) if the bracket isn't the
// user's or isn't a knockout bracket.
export async function setEnteredChallenge(
  userId: string,
  entryId: string,
  entered: boolean,
): Promise<boolean> {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, userId, format: "KNOCKOUT" },
    select: { id: true },
  });
  if (!entry) return false;

  await prisma.entry.update({
    where: { id: entry.id },
    data: { enteredChallenge: entered },
  });
  await recomputeEntry(entry.id);
  return true;
}
