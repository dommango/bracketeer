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
        subject: "Sign in to Bracketeer",
        text: `Sign in to Bracketeer:\n${url}\n`,
        html: `<p>Sign in to <b>Bracketeer</b>:</p><p><a href="${url}">${url}</a></p>`,
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
  pages: { signIn: "/signin" },
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
