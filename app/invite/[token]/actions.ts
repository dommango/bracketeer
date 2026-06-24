"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { acceptInvite } from "@/lib/pool/invites";
import { rateLimit } from "@/lib/rate-limit";

export interface AcceptInviteState {
  error?: string;
}

// useActionState-compatible: accept the invite for the signed-in user and land
// them in the pool. Bounces to sign-in (returning here) when unauthenticated, or
// returns an inline error for an invalid/expired/used invite or a full pool.
export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") || "");
  const user = await getSessionUser();
  if (!user) redirect(`/signin?callbackUrl=/invite/${encodeURIComponent(token)}`);

  if (!(await rateLimit(`accept-invite:${user.id}`, 20, 60_000)).ok) {
    return { error: "Too many attempts — wait a minute and try again." };
  }

  let joinCode: string;
  try {
    ({ joinCode } = await acceptInvite({ token, userId: user.id }));
  } catch (err) {
    return { error: (err as Error).message };
  }
  redirect(`/pool/${joinCode}`);
}
