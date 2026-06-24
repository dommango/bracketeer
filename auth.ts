// Auth.js v5 (next-auth beta) configuration.
//
// Next 16 note: there is no middleware-based guard here (middleware.ts was
// renamed to proxy.ts and we deliberately avoid it). Authorization is enforced
// inside route handlers / server components via the auth() helper exported below.
//
// Graceful degradation mirrors lib/env.ts: Google is registered only when its
// credentials are present, and the email magic-link logs the link to the server
// console when no SMTP server is configured, so sign-in works in local dev with
// zero external setup.

import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/db";
import { env, googleEnabled, facebookEnabled, emailEnabled } from "@/lib/env";
import { claimEntriesForUser } from "@/lib/auth/claim";

// Magic-link email body. A well-formed multipart message (greeting, a single
// clear CTA, an expiry/ignore note, sender identity) scores far better with spam
// filters than a bare one-line link — relevant because the friend-group launch
// sends from a cold Gmail account. `url` is an Auth.js-generated callback, so it
// needs no escaping.
function emailText(url: string): string {
  return [
    "Here's your sign-in link for Bracketeer.",
    "",
    "It's good for a single sign-in and expires shortly:",
    url,
    "",
    "If you didn't request this, you can safely ignore this email — no one can",
    "sign in without this link.",
    "",
    "— Bracketeer · World Cup 2026",
  ].join("\n");
}

function emailHtml(url: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1d1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e6e2;">
    <tr><td style="background:#0b6b3a;padding:18px 24px;">
      <span style="color:#f4c430;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Bracketeer &middot; World Cup 2026</span>
    </td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#1a1d1a;">Sign in to Bracketeer</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#4a4f49;">Tap the button below to finish signing in. This link is good for a single sign-in and expires shortly.</p>
      <a href="${url}" style="display:inline-block;background:#0b6b3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">Sign in</a>
      <p style="margin:22px 0 4px;font-size:12px;color:#8a8f88;">Or paste this link into your browser:</p>
      <p style="margin:0;font-size:12px;word-break:break-all;"><a href="${url}" style="color:#0b6b3a;">${url}</a></p>
      <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#8a8f88;">If you didn't request this, you can safely ignore this email — no one can sign in without this link.</p>
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid #e3e6e2;">
      <span style="font-size:11px;color:#8a8f88;">Bracketeer &middot; World Cup 2026 bracket pools</span>
    </td></tr>
  </table>
</body></html>`;
}

const providers: NextAuthConfig["providers"] = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      // Friend-group MVP: let the same email link Google + magic-link accounts.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (facebookEnabled) {
  providers.push(
    Facebook({
      clientId: env.AUTH_FACEBOOK_ID,
      clientSecret: env.AUTH_FACEBOOK_SECRET,
      // Friend-group MVP: let the same email link Facebook + magic-link accounts.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  Nodemailer({
    // A placeholder transport satisfies the provider's constructor check; in
    // degraded mode the custom sendVerificationRequest below never uses it.
    server: env.EMAIL_SERVER || { streamTransport: true, newline: "unix" },
    from: env.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url, provider }) {
      if (!emailEnabled) {
        // Never silently log a one-time sign-in link in production — fail loudly
        // so a missing EMAIL_SERVER is fixed rather than leaking links to logs.
        if (env.NODE_ENV === "production") {
          throw new Error("Email sign-in is not configured (set EMAIL_SERVER)");
        }
        console.log(`\n[auth] Magic sign-in link for ${identifier}:\n${url}\n`);
        return;
      }
      const transport = createTransport(provider.server);
      const result = await transport.sendMail({
        to: identifier,
        from: provider.from,
        subject: "Your Bracketeer sign-in link",
        text: emailText(url),
        html: emailHtml(url),
      });
      const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
      if (failed.length) throw new Error(`Magic-link email could not be sent to ${failed.join(", ")}`);
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  providers,
  // Auth.js infers its URL from the request; required behind reverse proxies.
  trustHost: true,
  secret: env.AUTH_SECRET,
  session: { strategy: "database" },
  // A custom verify-request page is required, not just nice-to-have: with a custom
  // signIn page set, Auth.js v5 otherwise throws UnknownAction ("Cannot handle
  // action: verify-request") when it tries to render the built-in one after a
  // magic-link send. Pointing it at our own page (app/verify-request) fixes it.
  pages: { signIn: "/signin", verifyRequest: "/verify-request" },
  callbacks: {
    // Database sessions: surface the user id so route handlers can authorize.
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Bind any entries imported for this email on every sign-in (idempotent).
    async signIn({ user, account }) {
      if (!user?.id) return;
      await claimEntriesForUser(user.id, user.email);
      // OAuth providers (Google/Facebook) only ever return a provider-verified
      // email, but the Prisma adapter doesn't populate emailVerified for them
      // (only the magic-link does). Stamp it on first OAuth sign-in so the prize
      // eligibility gate (verified email required) doesn't wrongly exclude the
      // majority of users. Guarded on null so we never clobber an existing stamp.
      if (account?.provider === "google" || account?.provider === "facebook") {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
