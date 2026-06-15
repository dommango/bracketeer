// Outbound transactional email, mirroring the graceful-degradation pattern in
// auth.ts: when EMAIL_SERVER is unset, links are logged to the server console in
// development and fail loudly in production (never silently dropped).

import { createTransport } from "nodemailer";
import { env, emailEnabled } from "@/lib/env";

export interface InviteEmailInput {
  to: string;
  url: string;
  poolName: string;
}

// Pool names are user-controlled; escape before embedding in the HTML body so a
// crafted name can't inject markup into the email.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendInviteEmail({ to, url, poolName }: InviteEmailInput): Promise<void> {
  if (!emailEnabled) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email is not configured (set EMAIL_SERVER)");
    }
    console.log(`\n[invite] Invite to "${poolName}" for ${to}:\n${url}\n`);
    return;
  }

  const transport = createTransport(env.EMAIL_SERVER);
  const result = await transport.sendMail({
    to,
    from: env.EMAIL_FROM,
    subject: `You're invited to ${poolName} on HessFest`,
    text: `You've been invited to join ${poolName} on HessFest.\nJoin here:\n${url}\n`,
    html: `<p>You've been invited to join <b>${escapeHtml(poolName)}</b> on HessFest.</p><p><a href="${url}">Join the pool →</a></p>`,
  });
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length) throw new Error(`Invite email could not be sent to ${failed.join(", ")}`);
}
