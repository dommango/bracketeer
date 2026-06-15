"use server";

import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess, canManagePool, type PoolAccess } from "@/lib/pool/access";
import {
  setMemberRole,
  removeMember,
  renamePool,
  deletePool,
  setEntryLocked,
  removeEntry,
} from "@/lib/pool/admin";
import { parseAssignableRole } from "@/lib/pool/admin-rules";
import { parseSubmissionCsv, importSubmission } from "@/lib/pool/import";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";
import { createInvite, revokeInvite } from "@/lib/pool/invites";
import { inviteUrl } from "@/lib/pool/invite-token";
import { sendInviteEmail } from "@/lib/email/send";
import { env } from "@/lib/env";

const MAX_CSV_BYTES = 1_000_000;
const MAX_FILES = 200;

// Resolve the pool and assert the caller may manage it (OWNER or ADMIN). 404s
// (via notFound) rather than 403s so non-managers can't probe a pool's existence.
async function requireManage(code: string): Promise<{ poolId: string; access: PoolAccess }> {
  const pool = await getPoolByCode(code);
  if (!pool) notFound();
  const access = await getPoolAccess(pool.id);
  if (!canManagePool(access)) notFound();
  return { poolId: pool.id, access };
}

// Governance operations (role changes, removals, deletion) are owner-only — an
// admin can run the pool's data but not restructure its membership or delete it.
async function requireOwner(code: string): Promise<{ poolId: string }> {
  const { poolId, access } = await requireManage(code);
  if (!access.isOwner) notFound();
  return { poolId };
}

function refresh(code: string): void {
  revalidatePath(`/pool/${code}/manage`);
}

export async function setMemberRoleAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireOwner(code);
  const membershipId = String(formData.get("membershipId") || "");
  const role = parseAssignableRole(String(formData.get("role") || ""));
  if (membershipId) await setMemberRole(poolId, membershipId, role);
  refresh(code);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireOwner(code);
  const membershipId = String(formData.get("membershipId") || "");
  if (membershipId) await removeMember(poolId, membershipId);
  refresh(code);
}

export async function renamePoolAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireManage(code);
  const name = String(formData.get("name") || "");
  await renamePool(poolId, name);
  refresh(code);
}

export async function deletePoolAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const confirm = String(formData.get("confirm") || "");
  const { poolId } = await requireOwner(code);
  // Require the join code typed back, so a stray click can't wipe a pool.
  if (confirm.trim().toUpperCase() !== code.toUpperCase()) {
    refresh(code);
    return;
  }
  await deletePool(poolId);
  redirect("/account");
}

export async function setEntryLockedAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireManage(code);
  const entryId = String(formData.get("entryId") || "");
  const locked = String(formData.get("locked") || "") === "true";
  if (entryId) await setEntryLocked(poolId, entryId, locked);
  refresh(code);
}

export async function removeEntryAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireManage(code);
  const entryId = String(formData.get("entryId") || "");
  if (entryId) {
    await removeEntry(poolId, entryId);
    await recomputePool(poolId);
    await notifyPool(poolId, "leaderboard");
  }
  refresh(code);
}

export interface InviteState {
  url?: string;
  email?: string | null;
  // Soft note when the invite was created but its email couldn't be delivered.
  error?: string;
}

// useActionState-compatible: mint an invite link (optionally pre-addressed) and,
// when an email is given, send it. The link is always returned so the owner can
// copy it even when email delivery isn't configured or fails.
export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const code = String(formData.get("code") || "");
  const { poolId, access } = await requireManage(code);

  if (!rateLimit(`invite:${access.user.id}`, 30, 60_000).ok) {
    return { error: "Too many invites — wait a minute and try again." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase() || null;
  const { token } = await createInvite({ poolId, createdById: access.user.id, email });
  const url = inviteUrl(env.APP_BASE_URL, token);

  let error: string | undefined;
  if (email) {
    const pool = await getPoolByCode(code);
    try {
      await sendInviteEmail({ to: email, url, poolName: pool?.name ?? "your pool" });
    } catch (err) {
      error = `Invite created, but the email couldn't be sent: ${(err as Error).message}`;
    }
  }

  refresh(code);
  return { url, email, error };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") || "");
  const { poolId } = await requireManage(code);
  const inviteId = String(formData.get("inviteId") || "");
  if (inviteId) await revokeInvite(inviteId, poolId);
  refresh(code);
}

export interface ImportState {
  ok?: boolean;
  imported?: number;
  failed?: number;
  error?: string;
}

// useActionState-compatible CSV import, mirroring the import API route but driven
// from the manage UI. Accepts one or more "file" fields.
export async function importCsvAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const code = String(formData.get("code") || "");
  const { poolId, access } = await requireManage(code);

  if (!rateLimit(`import:${access.user.id}`, 10, 60_000).ok) {
    return { error: "Too many imports — wait a minute and try again." };
  }

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one CSV file." };
  if (files.length > MAX_FILES) return { error: `Too many files (max ${MAX_FILES}).` };

  let imported = 0;
  let failed = 0;
  for (const file of files) {
    try {
      if (file.size > MAX_CSV_BYTES) throw new Error("File too large");
      await importSubmission(poolId, parseSubmissionCsv(await file.text()));
      imported += 1;
    } catch (err) {
      console.error(`import failed for ${file.name}:`, err);
      failed += 1;
    }
  }

  if (imported > 0) {
    await recomputePool(poolId);
    await notifyPool(poolId, "leaderboard");
  }
  refresh(code);
  return { ok: true, imported, failed };
}
