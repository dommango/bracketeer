"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { saveMyMd3Predictions } from "@/lib/challenge/md3-entry";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import type { Md3Scores } from "@/lib/pool/md3-picks";
import { rateLimit } from "@/lib/rate-limit";
import { ensureChallengeConsent } from "@/lib/account/consent";
import { publicLabel } from "@/lib/challenge/public-label";

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
  if (!user) return { error: "Sign in to enter Match Day Pickem." };

  if (!(await rateLimit(`md3-challenge-save:${user.id}`, 30, 60_000)).ok) {
    return { error: "Too many saves — give it a moment and try again." };
  }

  // Entering is prize-eligible, so it requires consent (18+ / Terms / Privacy /
  // Official Rules). Recorded once; subsequent saves pass through.
  const agreed = formData.get("agreed") === "on";
  if (!(await ensureChallengeConsent(user.id, agreed)).ok) {
    return {
      error: "Please confirm you're 18+ and accept the Terms, Privacy Policy and Official Rules to enter.",
    };
  }

  const scores = parseScores(formData);
  // Public-board label: the user's chosen leaderboard name if set, else their
  // account name. publicLabel never lets an email reach the board (falls back to
  // an anonymous handle when there's no usable name).
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { challengeDisplayName: true },
  });
  const label = publicLabel(account?.challengeDisplayName ?? user.name, user.id);

  try {
    await saveMyMd3Predictions({ userId: user.id, label, scores });
  } catch (err) {
    return { error: (err as Error).message };
  }

  revalidatePath("/challenge/md3");
  revalidatePath("/challenge/md3/play");
  return { ok: true };
}
