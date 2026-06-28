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
import { validateAdvanceMap, resolveAdvance, type AdvanceMap } from "@/lib/pool/knockout-advance";
import { CHALLENGE_ENTRY_CAP } from "@/lib/challenge/eligibility";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import type { Picks } from "@/lib/scoring/types";

// Shared knockout pick validation for the solo + pooled save paths. The client is
// untrusted: keep only knockout + awards, and either materialize the positional
// AdvanceMap (the source of truth) against the seed we control, or verify a legacy
// team-code save against it. Returns the cleaned picks + validated advance map, or
// throws a user-facing message. (early → projectedSeed, else the official seed.)
function prepareKnockoutSave(
  rawPicks: Picks,
  rawAdvance: AdvanceMap | undefined,
  open: boolean,
  seed: ResolvedR32,
  projectedSeed: ResolvedR32,
): { picks: Picks; knockoutAdvance: AdvanceMap | undefined } {
  const validationSeed = open ? seed : projectedSeed;
  let picks = knockoutOnlyPicks(rawPicks);
  let knockoutAdvance: AdvanceMap | undefined;
  if (rawAdvance !== undefined) {
    if (!validateAdvanceMap(rawAdvance)) throw new Error("Invalid bracket picks.");
    knockoutAdvance = rawAdvance;
    picks = { ...picks, knockout: resolveAdvance(knockoutAdvance, validationSeed) };
  } else if (inconsistentKnockoutPicks(picks, validationSeed).length > 0) {
    throw new Error("Some picks aren't valid for this bracket — please reload.");
  }
  const errors = validatePicks(picks);
  if (errors.length > 0) throw new Error(errors[0]);
  return { picks, knockoutAdvance };
}

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
  // Positional knockout picks (matchNo -> side) from the early/projected builder.
  knockoutAdvance?: AdvanceMap;
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
  const { open, earlyOpen, locksAt, seed, projectedSeed } = await getKnockoutState(tournamentId);
  if (!open && !earlyOpen) {
    throw new Error("Knockout picks aren't open yet — the last 32 aren't set.");
  }
  if (isKnockoutLocked(locksAt)) {
    throw new Error("Picks are locked — the Round of 32 has kicked off.");
  }

  const { picks, knockoutAdvance } = prepareKnockoutSave(
    input.picks,
    input.knockoutAdvance,
    open,
    seed,
    projectedSeed,
  );

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
    knockoutAdvance,
  });

  await recomputeEntry(res.entryId);
  return res;
}

export interface SaveKnockoutInput {
  userId: string;
  // The bracket to edit — required (this path never creates). May be pooled OR
  // standalone; its placement is resolved from the row.
  entryId: string;
  label: string;
  tiebreak: string;
  picks: Picks;
  knockoutAdvance?: AdvanceMap;
}

// Edit any one of the user's knockout brackets by id — pooled OR standalone. The
// Challenge picks switcher edits every bracket a user has entered in the Knockout
// Challenge from one surface, and a pooled entry can't go through saveSoloBracket
// (which pins poolId null). Resolve the bracket's placement from its row, then run
// the same knockout gate + validation + persist against that scope. Never creates.
export async function saveKnockoutBracket(input: SaveKnockoutInput): Promise<SaveSoloResult> {
  const entry = await prisma.entry.findFirst({
    where: { id: input.entryId, userId: input.userId, format: "KNOCKOUT" },
    select: { id: true, poolId: true, tournamentId: true },
  });
  if (!entry) throw new Error("That bracket can't be found or isn't yours to edit.");

  const { open, earlyOpen, locksAt, seed, projectedSeed } = await getKnockoutState(entry.tournamentId);
  if (!open && !earlyOpen) {
    throw new Error("Knockout picks aren't open yet — the last 32 aren't set.");
  }
  if (isKnockoutLocked(locksAt)) {
    throw new Error("Picks are locked — the Round of 32 has kicked off.");
  }

  const { picks, knockoutAdvance } = prepareKnockoutSave(
    input.picks,
    input.knockoutAdvance,
    open,
    seed,
    projectedSeed,
  );

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true },
  });

  const res = await upsertUiEntry({
    poolId: entry.poolId,
    tournamentId: entry.tournamentId,
    format: "KNOCKOUT",
    userId: input.userId,
    entryId: entry.id,
    label: input.label,
    picks,
    email: user?.email,
    tiebreak: input.tiebreak,
    knockoutAdvance,
  });

  // Only recompute this entry — unlike the in-pool submit we skip recomputePool +
  // notifyPool even for a pooled bracket. A knockout entry is editable only before
  // the R32 kickoff lock, and knockout officialResults don't exist until matches
  // play (after lock), so an editable bracket always scores 0: pool standings can't
  // move and pre-lock picks are private, so there's nothing to broadcast.
  await recomputeEntry(res.entryId);
  return res;
}

// Outcome of an opt-in attempt. ok=false with a reason when the cap is hit, so
// the caller can surface a clear message rather than a generic failure.
export interface EnterChallengeResult {
  ok: boolean;
  // Set only when the bracket couldn't be found / isn't a challenge bracket.
  notFound?: boolean;
  // Set when the per-person entry cap blocked a new opt-in.
  capReached?: boolean;
}

// Opt a bracket into (or out of) its public challenge. Works for both challenge
// formats — KNOCKOUT and MATCH_DAY_3_PICKEM (group/full brackets can't enter).
// Enforces the per-person, per-format entry cap on the way in: a user may have at
// most CHALLENGE_ENTRY_CAP entered brackets of a given format. Recomputes the
// entry so its cached score is fresh on the board. Returns notFound when the
// bracket isn't the user's challenge bracket.
export async function setEnteredChallenge(
  userId: string,
  entryId: string,
  entered: boolean,
): Promise<EnterChallengeResult> {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, userId, format: { in: ["KNOCKOUT", "MATCH_DAY_3_PICKEM"] } },
    select: { id: true, format: true, enteredChallenge: true },
  });
  if (!entry) return { ok: false, notFound: true };

  // Cap only applies when newly entering (not when leaving, and not when it's
  // already entered). Count the user's other entered brackets of the same format.
  if (entered && !entry.enteredChallenge) {
    const alreadyEntered = await prisma.entry.count({
      where: {
        userId,
        format: entry.format,
        enteredChallenge: true,
        id: { not: entry.id },
      },
    });
    if (alreadyEntered >= CHALLENGE_ENTRY_CAP) return { ok: false, capReached: true };
  }

  await prisma.entry.update({
    where: { id: entry.id },
    data: { enteredChallenge: entered },
  });
  await recomputeEntry(entry.id);
  return { ok: true };
}
