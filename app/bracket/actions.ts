"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/pool/access";
import { saveSoloBracket, setEnteredChallenge } from "@/lib/challenge/solo";
import { CHALLENGE_ENTRY_CAP } from "@/lib/challenge/eligibility";
import { attachEntryToPool } from "@/lib/pool/manage";
import { rateLimit } from "@/lib/rate-limit";
import { ensureChallengeConsent } from "@/lib/account/consent";
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
  // The saved bracket's id — returned so a "new bracket" form can keep editing
  // the row it just created instead of inserting another on the next save.
  entryId?: string;
}

export async function saveSoloBracketAction(raw: unknown): Promise<SoloSaveResult> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid picks payload." };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to save your bracket." };

  // Each save rewrites the entry + rescores it, so cap how often.
  if (!(await rateLimit(`solo:${user.id}`, 20, 60_000)).ok) {
    return { ok: false, error: "You're saving too often — wait a moment and try again." };
  }

  try {
    const res = await saveSoloBracket({
      userId: user.id,
      entryId: parsed.data.entryId,
      label: parsed.data.label,
      tiebreak: parsed.data.tiebreak,
      picks: parsed.data.picks as Picks,
    });
    revalidatePath("/bracket");
    revalidatePath("/challenge/knockout");
    revalidatePath("/challenge/knockout/leaderboard");
    return { ok: true, replaced: res.replaced, entryId: res.entryId };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const attachSchema = z.object({
  entryId: z.string().min(1),
  joinCode: z.string().min(1).max(16),
});

export interface AttachResult {
  ok: boolean;
  error?: string;
  // The pool's join code, so the client can route to /pool/<code> on success.
  joinCode?: string;
  poolName?: string;
}

export async function attachEntryToPoolAction(raw: unknown): Promise<AttachResult> {
  const parsed = attachSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a join code." };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (!(await rateLimit(`attach:${user.id}`, 20, 60_000)).ok) {
    return { ok: false, error: "Too many attempts — wait a moment and try again." };
  }

  try {
    const res = await attachEntryToPool({
      userId: user.id,
      entryId: parsed.data.entryId,
      joinCode: parsed.data.joinCode,
      displayName: user.name ?? undefined,
    });
    revalidatePath("/bracket");
    revalidatePath(`/pool/${res.joinCode}`);
    return { ok: true, joinCode: res.joinCode, poolName: res.poolName };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleChallengeAction(
  entryId: string,
  entered: boolean,
  agreed: boolean = false,
): Promise<SoloSaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (!(await rateLimit(`solo-toggle:${user.id}`, 20, 60_000)).ok) {
    return { ok: false, error: "Too many changes — wait a moment and try again." };
  }

  // Entering the prize challenge requires consent (18+ / Terms / Privacy / Rules).
  // Only gate on entry; leaving is always allowed.
  if (entered && !(await ensureChallengeConsent(user.id, agreed)).ok) {
    return {
      ok: false,
      error: "Please confirm you're 18+ and accept the Terms, Privacy Policy and Official Rules to enter.",
    };
  }

  try {
    const res = await setEnteredChallenge(user.id, entryId, entered);
    if (!res.ok) {
      if (res.capReached) {
        return {
          ok: false,
          error: `You can enter at most ${CHALLENGE_ENTRY_CAP} brackets in the Challenge.`,
        };
      }
      return { ok: false, error: "Build your knockout bracket before entering the Challenge." };
    }
    revalidatePath("/bracket");
    revalidatePath("/challenge/knockout");
    revalidatePath("/challenge/knockout/leaderboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
