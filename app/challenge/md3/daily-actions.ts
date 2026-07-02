"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { saveMyDailyKnockoutPredictions } from "@/lib/challenge/daily-knockout-entry";
import { DAILY_KNOCKOUT_MATCH_NOS } from "@/lib/games/daily-pickem/scope";
import type { DailyKnockoutScores } from "@/lib/games/daily-pickem/picks";
import { rateLimit } from "@/lib/rate-limit";
import { publicLabel } from "@/lib/challenge/public-label";

export interface SaveDailyKnockoutState {
  error?: string;
  ok?: boolean;
}

// Parse the form's home_<n> / away_<n> fields into a partial scores map. A fixture
// only counts when BOTH boxes hold a valid 0–99 integer. Server-authoritative
// orientation + per-match lock are applied downstream in upsertDailyKnockoutPicks.
function parseScores(formData: FormData): DailyKnockoutScores {
  const scores: DailyKnockoutScores = {};
  for (const matchNo of DAILY_KNOCKOUT_MATCH_NOS) {
    const homeRaw = String(formData.get(`home_${matchNo}`) ?? "").trim();
    const awayRaw = String(formData.get(`away_${matchNo}`) ?? "").trim();
    if (homeRaw === "" || awayRaw === "") continue;
    const home = Number(homeRaw);
    const away = Number(awayRaw);
    if (!Number.isInteger(home) || !Number.isInteger(away)) continue;
    if (home < 0 || away < 0 || home > 99 || away > 99) continue;
    scores[matchNo] = { home, away };
  }
  return scores;
}

// Save the signed-in user's knockout Match Day Pick'em predictions. Free game — no
// consent gate (unlike the group leg, which carried a prize). Entering is opting
// into the public knockout board.
export async function saveDailyKnockoutEntry(
  _prev: SaveDailyKnockoutState,
  formData: FormData,
): Promise<SaveDailyKnockoutState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to play the knockout pick'em." };

  if (!(await rateLimit(`daily-ko-save:${user.id}`, 30, 60_000)).ok) {
    return { error: "Too many saves — give it a moment and try again." };
  }

  const scores = parseScores(formData);
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { challengeDisplayName: true },
  });
  const label = publicLabel(account?.challengeDisplayName ?? user.name, user.id);

  try {
    await saveMyDailyKnockoutPredictions({ userId: user.id, label, scores });
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath("/challenge/md3");
  revalidatePath("/challenge/md3/play");
  return { ok: true };
}
