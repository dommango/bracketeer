"use server";

import { revalidatePath } from "next/cache";
import { getTournamentAdmin } from "@/lib/pool/access";
import { prisma } from "@/lib/db";
import { recomputePool, recomputeEntry } from "@/lib/pool/scoring";
import { TEAMS } from "@/lib/scoring/data";
import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { AWARD_KEYS } from "@/lib/scoring/csv";

function sectionFor(matchNo: number): string {
  if (matchNo >= 73 && matchNo <= 88) return "round_of_32";
  if (matchNo >= 89 && matchNo <= 96) return "round_of_16";
  if (matchNo >= 97 && matchNo <= 100) return "quarterfinals";
  if (matchNo >= 101 && matchNo <= 102) return "semifinals";
  if (matchNo === 104) return "final";
  throw new Error(`Unknown match number ${matchNo}`);
}

const ALL_MATCH_NOS = [
  ...R32.map((m) => m.id),
  ...R16.map((m) => m.id),
  ...QF.map((m) => m.id),
  ...SF.map((m) => m.id),
  FINAL.id,
];

export async function saveEntryPicksAction(
  entryId: string,
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!(await getTournamentAdmin())) return { ok: false, message: "Forbidden" };

    const entry = await prisma.entry.findUniqueOrThrow({
      where: { id: entryId },
      select: { id: true, poolId: true },
    });

    for (const matchNo of ALL_MATCH_NOS) {
      const code = String(formData.get(`m${matchNo}`) ?? "").trim();
      await prisma.pick.deleteMany({
        where: { entryId, category: `M${matchNo}` },
      });
      if (code && TEAMS[code]) {
        await prisma.pick.create({
          data: {
            entryId,
            section: sectionFor(matchNo),
            category: `M${matchNo}`,
            key: "winner_pick",
            code,
            teamOrValue: TEAMS[code],
          },
        });
      }
    }

    // Replace the four award rows wholesale (delete + recreate), matching the
    // knockout pattern above and the import path's always-4-rows shape — blanks
    // included, so a cleared award stays an empty row rather than vanishing.
    await prisma.$transaction([
      prisma.pick.deleteMany({ where: { entryId, section: "player_awards" } }),
      prisma.pick.createMany({
        data: AWARD_KEYS.map((key) => ({
          entryId,
          section: "player_awards",
          category: "award",
          key,
          code: "",
          teamOrValue: String(formData.get(`award:${key}`) ?? "").trim(),
        })),
      }),
    ]);

    // A standalone bracket (poolId null) has no pool to recompute — rescore it
    // on its own; a pooled bracket rescores the whole pool as before.
    if (entry.poolId) {
      await recomputePool(entry.poolId);
    } else {
      await recomputeEntry(entry.id);
    }
    revalidatePath(`/admin/entries/${entryId}`);
    revalidatePath("/admin/entries");
    return { ok: true, message: "Saved" };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
