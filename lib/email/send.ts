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

export interface PrizeEmailInput {
  to: string;
  // The challenge the recipient topped, e.g. "Knockout Challenge".
  challengeName: string;
  // The prize description, e.g. "a gift card".
  prizeDescription: string;
}

// Notify a public-challenge winner that they've topped the board. Best-effort —
// the prize resolver wraps this so a mail failure never blocks recording the
// award. Mirrors sendInviteEmail's keyless-degradation contract.
export async function sendPrizeEmail({
  to,
  challengeName,
  prizeDescription,
}: PrizeEmailInput): Promise<void> {
  const subject = `You won the ${challengeName} on Bracketeer! 🏆`;
  const body = `Congratulations — you finished top of the ${challengeName} and won ${prizeDescription}. We'll be in touch to arrange your prize.`;

  if (!emailEnabled) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email is not configured (set EMAIL_SERVER)");
    }
    console.log(`\n[prize] ${subject} -> ${to}:\n${body}\n`);
    return;
  }

  const transport = createTransport(env.EMAIL_SERVER);
  const result = await transport.sendMail({
    to,
    from: env.EMAIL_FROM,
    subject,
    text: `${body}\n`,
    html: `<p>${escapeHtml(body)}</p>`,
  });
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length) throw new Error(`Prize email could not be sent to ${failed.join(", ")}`);
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
    subject: `You're invited to ${poolName} on Bracketeer`,
    text: `You've been invited to join ${poolName} on Bracketeer.\nJoin here:\n${url}\n`,
    html: `<p>You've been invited to join <b>${escapeHtml(poolName)}</b> on Bracketeer.</p><p><a href="${url}">Join the pool →</a></p>`,
  });
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length) throw new Error(`Invite email could not be sent to ${failed.join(", ")}`);
}
