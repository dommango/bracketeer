"use server";

import { revalidatePath } from "next/cache";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess } from "@/lib/pool/access";
import { upsertMd3Picks, type Md3Scores } from "@/lib/pool/md3-picks";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";

export interface SaveMd3State {
  error?: string;
  ok?: boolean;
}

// Parse the form's home_<n> / away_<n> fields into a partial scores map. A
// fixture only counts when BOTH boxes are filled with a valid 0–99 integer.
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

export async function saveMd3Picks(
  _prev: SaveMd3State,
  formData: FormData,
): Promise<SaveMd3State> {
  const code = String(formData.get("code") || "");
  const pool = await getPoolByCode(code);
  if (!pool) return { error: "Pool not found." };
  if (pool.format !== "MATCH_DAY_3_PICKEM") {
    return { error: "This isn't a Match Day 3 Pickem game." };
  }

  const access = await getPoolAccess(pool.id);
  if (!access) return { error: "Join this pool before making picks." };

  if (!rateLimit(`md3-save:${access.user.id}`, 30, 60_000).ok) {
    return { error: "Too many saves — give it a moment and try again." };
  }

  const scores = parseScores(formData);
  const label = (access.user.name ?? access.user.email ?? "Player").trim();

  try {
    await upsertMd3Picks({ poolId: pool.id, userId: access.user.id, label, scores });
  } catch (err) {
    return { error: (err as Error).message };
  }

  // Land the entry on the board immediately (best-effort realtime nudge).
  await recomputePool(pool.id);
  await notifyPool(pool.id, "leaderboard");

  revalidatePath(`/pool/${code}/md3`);
  revalidatePath(`/pool/${code}`);
  return { ok: true };
}
