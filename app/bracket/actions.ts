"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/pool/access";
import { saveSoloBracket, setEnteredMaster } from "@/lib/master/solo";
import { rateLimit } from "@/lib/rate-limit";
import type { Picks } from "@/lib/scoring/types";

// Mirrors the pool picks schema; identity comes from the session, not the client.
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

const saveSchema = z.object({
  entryId: z.string().min(1).optional(),
  label: z.string().max(40),
  tiebreak: z.string().max(20),
  picks: picksSchema,
});

export interface SoloSaveResult {
  ok: boolean;
  error?: string;
  replaced?: boolean;
}

export async function saveSoloBracketAction(raw: unknown): Promise<SoloSaveResult> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid picks payload." };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to save your bracket." };

  // Each save rewrites the entry + recomputes the master pool, so cap how often.
  if (!rateLimit(`solo:${user.id}`, 20, 60_000).ok) {
    return { ok: false, error: "You're saving too often — wait a moment and try again." };
  }

  try {
    const res = await saveSoloBracket({
      userId: user.id,
      label: parsed.data.label,
      tiebreak: parsed.data.tiebreak,
      picks: parsed.data.picks as Picks,
    });
    revalidatePath("/bracket");
    revalidatePath("/master");
    return { ok: true, replaced: res.replaced };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleMasterAction(entered: boolean): Promise<SoloSaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (!rateLimit(`solo-toggle:${user.id}`, 20, 60_000).ok) {
    return { ok: false, error: "Too many changes — wait a moment and try again." };
  }

  try {
    const ok = await setEnteredMaster(user.id, entered);
    if (!ok) return { ok: false, error: "Build your bracket before entering the tournament." };
    revalidatePath("/bracket");
    revalidatePath("/master");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
