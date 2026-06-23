"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/pool/access";
import { saveMyMd3Predictions } from "@/lib/challenge/md3-entry";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import type { Md3Scores } from "@/lib/pool/md3-picks";
import { rateLimit } from "@/lib/rate-limit";

export interface SaveMd3ChallengeState {
  error?: string;
  ok?: boolean;
}

// Parse the form's home_<n> / away_<n> fields into a partial scores map. A fixture
// only counts when BOTH boxes hold a valid 0–99 integer.
function parseScores(formData: FormData): Md3Scores {
  const scores: Md3Scores = {};
  for (const matchNo of MD3_MATCH_NOS) {
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

// Save the signed-in user's Match Day 3 Pickem challenge predictions. Entering is
// playing — the entry lands on the public board once all 24 are predicted.
export async function saveMd3ChallengeEntry(
  _prev: SaveMd3ChallengeState,
  formData: FormData,
): Promise<SaveMd3ChallengeState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to enter the Match Day 3 Pickem challenge." };

  if (!rateLimit(`md3-challenge-save:${user.id}`, 30, 60_000).ok) {
    return { error: "Too many saves — give it a moment and try again." };
  }

  const scores = parseScores(formData);
  const label = (user.name ?? user.email ?? "Participant").trim();

  try {
    await saveMyMd3Predictions({ userId: user.id, label, scores });
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath("/challenge/md3");
  revalidatePath("/challenge/md3/play");
  return { ok: true };
}
