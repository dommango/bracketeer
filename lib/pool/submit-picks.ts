// In-app pick submission: persist a member's own bracket as an Entry + Pick rows
// (importedFrom = UI). Mirrors lib/pool/import.ts but keyed by userId rather than
// claimEmail, and refuses edits once the entry is locked. The pick rows go
// through the same submissionToPickRows builder the CSV path uses, so UI-entered
// and CSV-imported brackets are byte-identical in storage and scoring.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { submissionToPickRows, pickRowsToSubmission, type PickRow } from "@/lib/pool/picks";
import type { Picks, Submission } from "@/lib/scoring/types";
import { emptyPicks } from "@/lib/scoring/types";
import { asAdvanceMap, type AdvanceMap } from "@/lib/pool/knockout-advance";
import type { PoolFormat } from "@/generated/prisma/enums";
import { logEvent } from "@/lib/analytics/events";

export interface SubmitPicksInput {
  // The pool this bracket belongs to, or null for a standalone bracket (built
  // without a pool — e.g. the solo / Challenge flow). When null, tournamentId
  // and format are required and pin the bracket directly.
  poolId: string | null;
  tournamentId?: string;
  format?: PoolFormat;
  userId: string;
  // The bracket to edit. A user may own several brackets (CSV imports claimed on
  // sign-in, or multiple standalone brackets), so the target is identified
  // explicitly rather than by findFirst. Omit only to create a first bracket or
  // edit a lone existing one.
  entryId?: string | null;
  // Force a brand-new bracket even when the user already owns one in this scope —
  // for "new bracket" in the multi-bracket flow. Ignored when entryId is set
  // (that always edits the named bracket).
  forceCreate?: boolean;
  label: string;
  picks: Picks;
  email?: string | null;
  tiebreak?: string | null;
  // Positional knockout picks (matchNo -> "a"|"b"), for brackets built early
  // against projected placeholders. Persisted on the Entry as the source of truth
  // for knockout winners; `picks.knockout` carries the team codes materialized
  // against the current seed (for display). Omit for full-bracket / non-early saves.
  knockoutAdvance?: AdvanceMap;
}

export interface SubmitPicksResult {
  entryId: string;
  replaced: boolean;
}

export async function upsertUiEntry(input: SubmitPicksInput): Promise<SubmitPicksResult> {
  const result = await writeUiEntryWithRetry(input);
  // Engagement: every in-app bracket save (new or edit) is an activity signal.
  // Best-effort — a logging failure never breaks the submission.
  await logEvent({
    type: "ENTRY_SUBMIT",
    userId: input.userId,
    poolId: input.poolId,
    tournamentId: input.tournamentId ?? null,
    metadata: { replaced: result.replaced, format: input.format },
  });
  return result;
}

async function writeUiEntryWithRetry(input: SubmitPicksInput): Promise<SubmitPicksResult> {
  try {
    return await writeUiEntry(input);
  } catch (err) {
    // writeUiEntry already adopts a matching unclaimed row in place, so the only
    // way create still hits the (poolId, claimEmail, label) unique is a true race
    // (a concurrent create committed between our lookup and insert). Retry once:
    // the second pass sees the now-committed row and adopts/refuses it.
    if ((err as { code?: string }).code === "P2002") {
      return writeUiEntry(input);
    }
    throw err;
  }
}

async function writeUiEntry(input: SubmitPicksInput): Promise<SubmitPicksResult> {
  const label = input.label.trim() || "Player";
  const tiebreak = (input.tiebreak ?? "").trim() || null;
  const claimEmail = (input.email ?? "").trim().toLowerCase() || null;
  const sub: Submission = {
    contestant: { name: label, email: claimEmail ?? "", tiebreak: tiebreak ?? "" },
    picks: input.picks,
  };
  const pickRows: PickRow[] = submissionToPickRows(sub);

  return prisma.$transaction(async (tx) => {
    // A bracket carries its own tournament + format. A pooled bracket inherits
    // both from its pool; a standalone bracket (poolId null) is pinned by the
    // tournamentId/format passed in.
    let tournamentId: string;
    let format: PoolFormat;
    if (input.poolId) {
      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: input.poolId },
        select: { tournamentId: true, format: true },
      });
      tournamentId = pool.tournamentId;
      format = pool.format;
    } else {
      if (!input.tournamentId || !input.format) {
        throw new Error("A standalone bracket needs a tournament and format.");
      }
      tournamentId = input.tournamentId;
      format = input.format;
    }

    // The owner scope identifies which brackets are "this user's, in this place".
    // Pooled: (poolId, userId). Standalone: (poolId null, tournamentId, format,
    // userId) — so a user's standalone brackets in other tournaments/formats and
    // their pooled brackets never collide here.
    const ownerScope = input.poolId
      ? { poolId: input.poolId, userId: input.userId }
      : { poolId: null, tournamentId, format, userId: input.userId };

    // Resolve the bracket to write WITHOUT guessing. With an explicit entryId we
    // edit exactly that entry (after verifying it's the user's, in scope); a
    // foreign or unknown id is rejected. Without one we create the user's first
    // bracket, edit their lone bracket, or refuse when ownership is ambiguous.
    let existing: { id: string; locked: boolean; adopt: boolean } | null;
    if (input.entryId) {
      const target = await tx.entry.findFirst({
        where: { id: input.entryId, ...ownerScope },
        select: { id: true, locked: true },
      });
      if (!target) {
        throw new Error("That bracket can't be found or isn't yours to edit.");
      }
      existing = { ...target, adopt: false };
    } else if (input.forceCreate) {
      // A deliberate "new bracket": never adopt or edit an existing one.
      existing = null;
    } else {
      const owned = await tx.entry.findMany({
        where: ownerScope,
        select: { id: true, locked: true },
      });
      if (owned.length > 1) {
        throw new Error("You have more than one bracket here — choose which one to edit.");
      }
      existing = owned[0] ? { ...owned[0], adopt: false } : null;

      // No bracket of their own yet: an unclaimed import under this same email +
      // label is effectively theirs (claim binds by email), so adopt it rather
      // than collide with the (poolId, claimEmail, label) unique on create. A row
      // owned by someone else is a real name clash and is refused. Only pooled
      // brackets carry CSV-imported siblings, so this path is pool-only.
      if (!existing && claimEmail && input.poolId) {
        const clash = await tx.entry.findFirst({
          where: { poolId: input.poolId, claimEmail, label },
          select: { id: true, locked: true, userId: true },
        });
        if (clash) {
          if (clash.userId && clash.userId !== input.userId) {
            throw new Error("A bracket with that name already exists in this pool.");
          }
          existing = { id: clash.id, locked: clash.locked, adopt: clash.userId !== input.userId };
        }
      }
    }

    if (existing) {
      if (existing.locked) {
        throw new Error("Your picks are locked and can no longer be edited.");
      }
      await tx.pick.deleteMany({ where: { entryId: existing.id } });
      await tx.entry.update({
        where: { id: existing.id },
        data: {
          label,
          claimEmail,
          tiebreak,
          importedFrom: "UI",
          ...(input.knockoutAdvance !== undefined
            ? { knockoutAdvance: input.knockoutAdvance as Prisma.InputJsonValue }
            : {}),
          ...(existing.adopt ? { userId: input.userId } : {}),
        },
      });
      await tx.pick.createMany({
        data: pickRows.map((r) => ({ ...r, entryId: existing.id })),
      });
      return { entryId: existing.id, replaced: true };
    }

    const entry = await tx.entry.create({
      data: {
        poolId: input.poolId,
        tournamentId,
        format,
        userId: input.userId,
        label,
        claimEmail,
        tiebreak,
        importedFrom: "UI",
        ...(input.knockoutAdvance !== undefined
          ? { knockoutAdvance: input.knockoutAdvance as Prisma.InputJsonValue }
          : {}),
      },
    });
    await tx.pick.createMany({
      data: pickRows.map((r) => ({ ...r, entryId: entry.id })),
    });
    return { entryId: entry.id, replaced: false };
  });
}

export interface UserEntry {
  entryId: string;
  label: string;
  locked: boolean;
  tiebreak: string;
  picks: Picks;
  // Positional knockout picks if this bracket was built early; empty otherwise.
  // The builder re-hydrates its AdvanceMap from this so early picks survive reloads.
  knockoutAdvance: AdvanceMap;
}

export interface UserEntrySummary {
  entryId: string;
  label: string;
  locked: boolean;
  importedFrom: string;
}

// Every bracket the user owns in a pool, in import/creation order — for the
// picks-page chooser when a user holds more than one (e.g. claimed CSV imports).
export async function getUserEntries(poolId: string, userId: string): Promise<UserEntrySummary[]> {
  const entries = await prisma.entry.findMany({
    where: { poolId, userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, locked: true, importedFrom: true },
  });
  return entries.map((e) => ({
    entryId: e.id,
    label: e.label,
    locked: e.locked,
    importedFrom: e.importedFrom,
  }));
}

// Decode the first entry matching a scope into a Picks object for prefilling the
// form. Shared by the pooled and standalone readers below. Null when none match.
async function decodeEntry(where: Prisma.EntryWhereInput): Promise<UserEntry | null> {
  const entry = await prisma.entry.findFirst({
    where,
    select: {
      id: true,
      label: true,
      locked: true,
      tiebreak: true,
      knockoutAdvance: true,
      picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
    },
  });
  if (!entry) return null;

  const picks: Picks =
    entry.picks.length > 0 ? pickRowsToSubmission(entry.picks).picks : emptyPicks();

  return {
    entryId: entry.id,
    label: entry.label,
    locked: entry.locked,
    tiebreak: entry.tiebreak ?? "",
    picks,
    knockoutAdvance: asAdvanceMap(entry.knockoutAdvance),
  };
}

// One of the user's pooled brackets. Pass entryId to target a specific bracket
// (verified as theirs); omit it for the single-bracket case.
export function getUserEntry(
  poolId: string,
  userId: string,
  entryId?: string | null,
): Promise<UserEntry | null> {
  return decodeEntry(entryId ? { id: entryId, poolId, userId } : { poolId, userId });
}

// One of the user's standalone brackets (poolId null) for a tournament+format —
// the solo / Challenge flow. Pass entryId to target a specific bracket.
export function getStandaloneEntry(
  tournamentId: string,
  userId: string,
  format: PoolFormat,
  entryId?: string | null,
): Promise<UserEntry | null> {
  const scope = { poolId: null, tournamentId, format, userId };
  return decodeEntry(entryId ? { id: entryId, ...scope } : scope);
}

// Any one of the user's knockout brackets by id — pooled OR standalone — decoded
// for the builder. Backs the Knockout Challenge picks switcher, which edits every
// bracket the user has entered in the Challenge regardless of where it lives.
export function getUserKnockoutEntry(
  userId: string,
  entryId: string,
): Promise<UserEntry | null> {
  return decodeEntry({ id: entryId, userId, format: "KNOCKOUT" });
}
