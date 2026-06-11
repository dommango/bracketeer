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
    // Two concurrent saves (double-submit) can both pass findFirst; the
    // (poolId, userId) unique rejects the duplicate — retry once so the loser
    // updates the winner's row instead of failing the save.
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
    const existing = await tx.entry.findFirst({
      where: { poolId: input.poolId, userId: input.userId },
      select: { id: true, locked: true },
    });

    if (existing) {
      if (existing.locked) {
        throw new Error("Your picks are locked and can no longer be edited.");
      }
      await tx.pick.deleteMany({ where: { entryId: existing.id } });
      await tx.entry.update({
        where: { id: existing.id },
        data: { label, claimEmail, tiebreak, importedFrom: "UI" },
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

// The current user's entry in a pool, decoded back into a Picks object for
// prefilling the form. Null when they have no entry yet.
export async function getUserEntry(poolId: string, userId: string): Promise<UserEntry | null> {
  const entry = await prisma.entry.findFirst({
    where: { poolId, userId },
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
