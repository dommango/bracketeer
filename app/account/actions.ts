"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { rateLimit } from "@/lib/rate-limit";
import { deleteUserAccount, AccountDeletionBlockedError } from "@/lib/account/delete";
import { signOut } from "@/auth";

// Update the display name on one of the current user's memberships. Ownership is
// enforced by scoping the update to (membershipId, userId), so a forged id can't
// touch another member's row.
export async function updateDisplayNameAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const membershipId = String(formData.get("membershipId") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  if (!membershipId || !displayName) {
    revalidatePath("/account");
    return;
  }

  await prisma.membership.updateMany({
    where: { id: membershipId, userId: user.id },
    data: { displayName: displayName.slice(0, 40) },
  });
  revalidatePath("/account");
}

// Permanently delete the signed-in user's account and all their data. Requires
// the user to type DELETE to confirm (mirrors the pool-delete confirmation), so a
// stray click can't wipe an account. Signs out afterwards (their session row is
// already gone via cascade) and lands on the home page.
export async function deleteMyAccountAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  if (!(await rateLimit(`account-delete:${user.id}`, 5, 60_000)).ok) {
    revalidatePath("/account");
    return;
  }

  const confirm = String(formData.get("confirm") || "").trim().toUpperCase();
  if (confirm !== "DELETE") {
    revalidatePath("/account");
    return;
  }

  try {
    await deleteUserAccount(user.id);
  } catch (err) {
    // Backstop for the race where a prize is awarded between page load and submit
    // (the page already hides the form when a prize is pending). Re-render so the
    // blocked notice shows instead of crashing the action.
    if (err instanceof AccountDeletionBlockedError) {
      revalidatePath("/account");
      return;
    }
    throw err;
  }
  await signOut({ redirectTo: "/" });
}
