"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";

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
