"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { createPool } from "@/lib/pool/manage";
import { rateLimit } from "@/lib/rate-limit";

export interface CreatePoolState {
  error?: string;
}

// useActionState-compatible: returns inline feedback so a bad name surfaces on
// the form rather than throwing a 500. On success it redirects to the new pool.
export async function createPoolAction(
  _prev: CreatePoolState,
  formData: FormData,
): Promise<CreatePoolState> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  // Cap pool creation so one account can't spawn pools en masse.
  if (!rateLimit(`pool-create:${user.id}`, 10, 3_600_000).ok) {
    return { error: "You've created a lot of pools — try again later." };
  }

  const name = String(formData.get("name") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  if (!name) return { error: "Give your pool a name." };

  let joinCode: string;
  try {
    ({ joinCode } = await createPool({ userId: user.id, name, displayName }));
  } catch (err) {
    return { error: (err as Error).message };
  }
  redirect(`/pool/${joinCode}`);
}
