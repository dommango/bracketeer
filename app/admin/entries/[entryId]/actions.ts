"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTournamentAdmin } from "@/lib/pool/access";
import { prisma } from "@/lib/db";
import { recomputePool } from "@/lib/pool/scoring";
import { TEAMS } from "@/lib/scoring/data";
import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";

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

export async function saveEntryKnockoutAction(
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

    await recomputePool(entry.poolId);
    revalidatePath(`/admin/entries/${entryId}`);
    revalidatePath("/admin/entries");
    return { ok: true, message: "Saved" };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
