// Import a contestant submission (parsed from the friend group's CSV) into a
// pool as an Entry + Pick rows. Idempotent: re-importing the same contestant
// replaces their entry's picks in a single transaction.

import { prisma } from "@/lib/db";
import { parseCsv, csvRowsToSubmission } from "@/lib/scoring/csv";
import { submissionToPickRows } from "@/lib/pool/picks";
import { z } from "zod";
import type { Submission } from "@/lib/scoring/types";

// Validate the decoded submission shape before persisting.
const submissionSchema = z.object({
  contestant: z.object({
    name: z.string(),
    email: z.string(),
    tiebreak: z.string(),
  }),
  picks: z.object({
    groupFirst: z.record(z.string(), z.string()),
    groupSecond: z.record(z.string(), z.string()),
    thirdAdvance: z.array(z.string()),
    knockout: z.record(z.string(), z.string()),
    awards: z.object({
      player: z.string(),
      young: z.string(),
      boot: z.string(),
      goal: z.string(),
    }),
  }),
});

export function parseSubmissionCsv(text: string): Submission {
  const sub = csvRowsToSubmission(parseCsv(text));
  if (!sub) {
    throw new Error("CSV is missing required columns (section, key, code…)");
  }
  return submissionSchema.parse(sub) as Submission;
}

export interface ImportResult {
  entryId: string;
  label: string;
  replaced: boolean;
}

// Persist a submission into a pool. The entry is keyed by claimEmail when an
// email is present, otherwise by label (contestant name), so re-imports update
// in place rather than duplicating.
export async function importSubmission(
  poolId: string,
  sub: Submission,
): Promise<ImportResult> {
  const label = sub.contestant.name.trim() || "Anonymous";
  const claimEmail = sub.contestant.email.trim().toLowerCase() || null;
  const tiebreak = sub.contestant.tiebreak.trim() || null;
  const pickRows = submissionToPickRows(sub);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.entry.findFirst({
      where: claimEmail ? { poolId, claimEmail } : { poolId, label },
    });

    if (existing) {
      await tx.pick.deleteMany({ where: { entryId: existing.id } });
      await tx.entry.update({
        where: { id: existing.id },
        data: { label, claimEmail, tiebreak },
      });
      await tx.pick.createMany({
        data: pickRows.map((r) => ({ ...r, entryId: existing.id })),
      });
      return { entryId: existing.id, label, replaced: true };
    }

    const entry = await tx.entry.create({
      data: { poolId, label, claimEmail, tiebreak, importedFrom: "CSV" },
    });
    await tx.pick.createMany({
      data: pickRows.map((r) => ({ ...r, entryId: entry.id })),
    });
    return { entryId: entry.id, label, replaced: false };
  });
}
