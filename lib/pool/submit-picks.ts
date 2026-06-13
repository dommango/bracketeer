// In-app pick submission: persist a member's own bracket as an Entry + Pick rows
// (importedFrom = UI). Mirrors lib/pool/import.ts but keyed by userId rather than
// claimEmail, and refuses edits once the entry is locked. The pick rows go
// through the same submissionToPickRows builder the CSV path uses, so UI-entered
// and CSV-imported brackets are byte-identical in storage and scoring.

import { prisma } from "@/lib/db";
import { submissionToPickRows, pickRowsToSubmission, type PickRow } from "@/lib/pool/picks";
import type { Picks, Submission } from "@/lib/scoring/types";
import { emptyPicks } from "@/lib/scoring/types";

export interface SubmitPicksInput {
  poolId: string;
  userId: string;
  // The bracket to edit. A user may own several brackets in a pool (CSV imports
  // claimed on sign-in), so the target is identified explicitly rather than by
  // findFirst. Omit only to create a first bracket or edit a lone existing one.
  entryId?: string | null;
  label: string;
  picks: Picks;
  email?: string | null;
  tiebreak?: string | null;
}

export interface SubmitPicksResult {
  entryId: string;
  replaced: boolean;
}

export async function upsertUiEntry(input: SubmitPicksInput): Promise<SubmitPicksResult> {
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
    // Resolve the bracket to write WITHOUT guessing. With an explicit entryId we
    // edit exactly that entry (after verifying it belongs to this user+pool); a
    // foreign or unknown id is rejected. Without one we create the user's first
    // bracket, edit their lone bracket, or refuse when ownership is ambiguous.
    let existing: { id: string; locked: boolean; adopt: boolean } | null;
    if (input.entryId) {
      const target = await tx.entry.findFirst({
        where: { id: input.entryId, poolId: input.poolId, userId: input.userId },
        select: { id: true, locked: true },
      });
      if (!target) {
        throw new Error("That bracket can't be found or isn't yours to edit.");
      }
      existing = { ...target, adopt: false };
    } else {
      const owned = await tx.entry.findMany({
        where: { poolId: input.poolId, userId: input.userId },
        select: { id: true, locked: true },
      });
      if (owned.length > 1) {
        throw new Error("You have more than one bracket here — choose which one to edit.");
      }
      existing = owned[0] ? { ...owned[0], adopt: false } : null;

      // No bracket of their own yet: an unclaimed import under this same email +
      // label is effectively theirs (claim binds by email), so adopt it rather
      // than collide with the (poolId, claimEmail, label) unique on create. A row
      // owned by someone else is a real name clash and is refused.
      if (!existing && claimEmail) {
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
        userId: input.userId,
        label,
        claimEmail,
        tiebreak,
        importedFrom: "UI",
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

// One of the user's brackets, decoded back into a Picks object for prefilling
// the form. Pass entryId to target a specific bracket (verified as theirs);
// omit it for the single-bracket case. Null when no matching entry exists.
export async function getUserEntry(
  poolId: string,
  userId: string,
  entryId?: string | null,
): Promise<UserEntry | null> {
  const entry = await prisma.entry.findFirst({
    where: entryId ? { id: entryId, poolId, userId } : { poolId, userId },
    select: {
      id: true,
      label: true,
      locked: true,
      tiebreak: true,
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
  };
}
