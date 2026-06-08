"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import {
  setGroupStandings,
  setKnockoutResult,
  clearKnockoutResult,
  setAwards,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { GROUPS } from "@/lib/scoring/data";

async function adminTournamentId(): Promise<string> {
  if (!(await getTournamentAdmin())) redirect("/signin?error=forbidden");
  return getTournamentIdBySlug();
}

export async function saveStandingsAction(formData: FormData): Promise<void> {
  const tournamentId = await adminTournamentId();

  const groupFirst: Record<string, string> = {};
  const groupSecond: Record<string, string> = {};
  for (const g of Object.keys(GROUPS)) {
    const f = String(formData.get(`first_${g}`) || "");
    if (f) groupFirst[g] = f;
    const s = String(formData.get(`second_${g}`) || "");
    if (s) groupSecond[g] = s;
  }
  const thirdAdvance: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const t = String(formData.get(`third_${i}`) || "");
    if (t) thirdAdvance.push(t);
  }

  await setGroupStandings(tournamentId, { groupFirst, groupSecond, thirdAdvance });
  await recomputeTournamentPools(tournamentId);
  revalidatePath("/admin");
}

export async function saveAwardsAction(formData: FormData): Promise<void> {
  const tournamentId = await adminTournamentId();
  await setAwards(tournamentId, {
    player: String(formData.get("player") || ""),
    young: String(formData.get("young") || ""),
    boot: String(formData.get("boot") || ""),
    goal: String(formData.get("goal") || ""),
  });
  await recomputeTournamentPools(tournamentId);
  revalidatePath("/admin");
}

export interface KnockoutActionState {
  ok?: boolean;
  message?: string;
}

// useActionState-compatible: returns inline feedback rather than throwing, so a
// rejected winner (not in the match) surfaces next to the row.
export async function saveKnockoutAction(
  _prev: KnockoutActionState,
  formData: FormData,
): Promise<KnockoutActionState> {
  try {
    if (!(await getTournamentAdmin())) return { ok: false, message: "Forbidden" };
    const tournamentId = await getTournamentIdBySlug();

    const matchNo = Number(formData.get("matchNo"));
    if (!Number.isInteger(matchNo)) return { ok: false, message: "Bad match number" };

    const winner = String(formData.get("winner") || "");
    const hsRaw = String(formData.get("homeScore") ?? "");
    const asRaw = String(formData.get("awayScore") ?? "");

    if (!winner) {
      await clearKnockoutResult(tournamentId, matchNo);
      await recomputeTournamentPools(tournamentId);
      revalidatePath("/admin");
      return { ok: true, message: "Cleared" };
    }

    await setKnockoutResult(tournamentId, matchNo, {
      winnerCode: winner,
      homeScore: hsRaw === "" ? null : Number(hsRaw),
      awayScore: asRaw === "" ? null : Number(asRaw),
    });
    await recomputeTournamentPools(tournamentId);
    revalidatePath("/admin");
    return { ok: true, message: `Saved ${winner}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
