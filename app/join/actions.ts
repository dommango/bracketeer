"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { joinPool } from "@/lib/pool/manage";
import { rateLimit } from "@/lib/rate-limit";

export interface JoinPoolState {
  error?: string;
}

// useActionState-compatible: enrolls the user and redirects to the pool, or
// returns an inline error (bad code / unknown pool).
export async function joinPoolAction(
  _prev: JoinPoolState,
  formData: FormData,
): Promise<JoinPoolState> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  // Cap join attempts so a stolen session can't brute-force join codes.
  if (!(await rateLimit(`join:${user.id}`, 30, 60_000)).ok) {
    return { error: "Too many attempts — wait a minute and try again." };
  }

  const joinCode = String(formData.get("code") || "");
  const displayName = String(formData.get("displayName") || "");

  let code: string;
  try {
    ({ joinCode: code } = await joinPool({ userId: user.id, joinCode, displayName }));
  } catch (err) {
    return { error: (err as Error).message };
  }
  redirect(`/pool/${code}`);
}
