"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser, getPoolAccess } from "@/lib/pool/access";
import { getPoolByCode } from "@/lib/pool/queries";
import { arePicksLocked } from "@/lib/pool/lock";
import { upsertUiEntry } from "@/lib/pool/submit-picks";
import { validatePicks } from "@/lib/pool/pick-form";
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

  if (arePicksLocked(pool.tournament.startsAt)) {
    return { ok: false, error: "Picks are locked — the tournament has kicked off." };
  }

  const errors = validatePicks(picks as Picks);
  if (errors.length > 0) return { ok: false, error: errors[0] };

  try {
    const res = await upsertUiEntry({
      poolId: pool.id,
      userId: user.id,
      entryId,
      label,
      picks: picks as Picks,
      email: user.email,
      tiebreak,
    });
    await recomputePool(pool.id);
    await notifyPool(pool.id, "leaderboard");
    revalidatePath(`/pool/${code}`);
    return { ok: true, replaced: res.replaced };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
