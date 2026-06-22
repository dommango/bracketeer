"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser, getPoolAccess } from "@/lib/pool/access";
import { getPoolByCode, getKnockoutState } from "@/lib/pool/queries";
import { arePicksLocked } from "@/lib/pool/lock";
import { upsertUiEntry } from "@/lib/pool/submit-picks";
import { validatePicks, inconsistentKnockoutPicks } from "@/lib/pool/pick-form";
import { isKnockoutLocked, knockoutOnlyPicks } from "@/lib/pool/knockout";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";
import type { Picks } from "@/lib/scoring/types";

// Mirrors the import.ts submission schema (picks half only); the contestant
// identity comes from the session, not the client payload.
const picksSchema = z.object({
  groupFirst: z.record(z.string(), z.string()),
  groupSecond: z.record(z.string(), z.string()),
  thirdAdvance: z.array(z.string()).max(8),
  knockout: z.record(z.string(), z.string()),
  awards: z.object({
    player: z.string(),
    young: z.string(),
    boot: z.string(),
    goal: z.string(),
  }),
});

const inputSchema = z.object({
  code: z.string().min(1),
  // The bracket being edited. Omitted when creating a first bracket; required to
  // disambiguate when the user owns more than one in the pool.
  entryId: z.string().min(1).optional(),
  label: z.string().max(40),
  tiebreak: z.string().max(20),
  picks: picksSchema,
});

export interface SubmitPicksResult {
  ok: boolean;
  error?: string;
  replaced?: boolean;
  complete?: boolean;
  // The saved bracket's id, so a freshly-created bracket keeps editing the same
  // row rather than inserting another on the next save.
  entryId?: string;
}

export async function submitPicksAction(raw: unknown): Promise<SubmitPicksResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid picks payload." };
  const { code, entryId, label, tiebreak, picks } = parsed.data;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to submit your picks." };

  // Each save rewrites the entry + recomputes the pool, so cap how often.
  if (!rateLimit(`picks:${user.id}`, 20, 60_000).ok) {
    return { ok: false, error: "You're saving too often — wait a moment and try again." };
  }

  const pool = await getPoolByCode(code);
  if (!pool) return { ok: false, error: "Pool not found." };

  const access = await getPoolAccess(pool.id);
  if (!access) return { ok: false, error: "Join this pool before submitting picks." };

  // Lock gating differs by game: a knockout pool opens once the 32 are set and
  // locks at the Round-of-32 kickoff; a full-bracket pool locks at the tournament
  // kickoff. (For a knockout pool the tournament start is long past, so the
  // full-bracket guard would wrongly reject every save.)
  let picksToSave = picks as Picks;
  if (pool.format === "KNOCKOUT") {
    const { open, locksAt, seed } = await getKnockoutState(pool.tournament.id);
    if (!open) {
      return { ok: false, error: "Knockout picks aren't open yet — the last 32 aren't set." };
    }
    if (isKnockoutLocked(locksAt)) {
      return { ok: false, error: "Picks are locked — the Round of 32 has kicked off." };
    }
    // Keep only knockout + awards (drop any group data adopted from a CSV import),
    // then reject winners that aren't actually in their match per the official
    // seed — the client is untrusted, so the seed is the authority, not the payload.
    picksToSave = knockoutOnlyPicks(picksToSave);
    if (inconsistentKnockoutPicks(picksToSave, seed).length > 0) {
      return { ok: false, error: "Some picks aren't valid for this bracket — please reload." };
    }
  } else if (arePicksLocked(pool.tournament.startsAt)) {
    return { ok: false, error: "Picks are locked — the tournament has kicked off." };
  }

  const errors = validatePicks(picksToSave);
  if (errors.length > 0) return { ok: false, error: errors[0] };

  let res;
  try {
    res = await upsertUiEntry({
      poolId: pool.id,
      userId: user.id,
      entryId,
      label,
      picks: picksToSave,
      email: user.email,
      tiebreak,
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // The entry is committed. A failure refreshing the cached leaderboard must not
  // report the save as failed (it would prompt a needless re-save); the board
  // self-heals on the next recompute. notifyPool is already best-effort.
  try {
    await recomputePool(pool.id);
    await notifyPool(pool.id, "leaderboard");
  } catch (err) {
    console.error("post-save leaderboard recompute failed:", err);
  }
  revalidatePath(`/pool/${code}`);
  return { ok: true, replaced: res.replaced, entryId: res.entryId };
}
