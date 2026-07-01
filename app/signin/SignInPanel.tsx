import Link from "next/link";
import { signIn } from "@/auth";
import { googleEnabled, facebookEnabled, emailEnabled } from "@/lib/env";
import { PublicGames } from "@/app/PublicGames";

// Only same-origin relative paths are honored as a post-sign-in destination, so
// a crafted ?callbackUrl can't turn sign-in into an open redirect. Reject
// protocol-relative (`//host`) and backslash forms (`/\host`, `/\/host`) —
// browsers fold `\` to `/`, so those would otherwise resolve off-site.
export function safeCallback(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

async function emailSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email) return;
  const redirectTo = safeCallback(String(formData.get("callbackUrl") || "/"));
  await signIn("nodemailer", { email, redirectTo });
}

async function googleSignIn(formData: FormData) {
  "use server";
  const redirectTo = safeCallback(String(formData.get("callbackUrl") || "/"));
  await signIn("google", { redirectTo });
}

async function facebookSignIn(formData: FormData) {
  "use server";
  const redirectTo = safeCallback(String(formData.get("callbackUrl") || "/"));
  await signIn("facebook", { redirectTo });
}

// Shared sign-in / register panel. No client JS: each option is a server action
// that hands off to Auth.js, which performs the redirect. Auth.js creates the
// account on first sign-in, so this single panel covers both new and returning
// players. Rendered both at `/` (signed-out) and at `/signin`.
export function SignInPanel({ error, dest }: { error?: string; dest: string }) {
  const now = new Date();
  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-12">
      <div className="relative overflow-hidden rounded-[32px] bg-pitch p-8 text-white shadow-[var(--shadow-lg)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/brand-26-pattern.avif)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <div className="relative">
          <div
            className="inline-block max-w-full rounded-2xl p-4"
            style={{
              background: "rgba(0,0,0,0.42)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">BRACKETEER · WORLD CUP 2026</p>
            <h1 className="mt-2.5 font-display text-2xl [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              Sign in or create an account
            </h1>
            <p className="mt-2 text-sm text-white/90">
              Make your picks, track the live leaderboard, and join the chat.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-[var(--negative)]/25 bg-[var(--negative-tint)] px-4 py-3 text-sm text-[var(--negative)]">
          Sign-in failed ({error}). Please try again.
        </p>
      ) : null}

      <div className="mt-6 space-y-4 rounded-3xl border border-line bg-surface p-6">
        {googleEnabled || facebookEnabled ? (
          <div className="space-y-3">
            {googleEnabled ? (
              <form action={googleSignIn}>
                <input type="hidden" name="callbackUrl" value={dest} />
                <OAuthButton icon={<GoogleIcon />} label="Continue with Google" />
              </form>
            ) : null}
            {facebookEnabled ? (
              <form action={facebookSignIn}>
                <input type="hidden" name="callbackUrl" value={dest} />
                <OAuthButton icon={<FacebookIcon />} label="Continue with Facebook" />
              </form>
            ) : null}
            <div className="flex items-center gap-3 pt-1" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        ) : null}

        <form action={emailSignIn} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={dest} />
          <label className="block text-sm font-semibold text-ink-2" htmlFor="email">
            Email magic link
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-line bg-surface px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
          />
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-pitch font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99]"
          >
            Email me a sign-in link
          </button>
          {!emailEnabled ? (
            <p className="text-xs text-ink-3">
              Email delivery is not configured — the magic link is printed to the server console
              for local development.
            </p>
          ) : null}
        </form>
      </div>

      <p className="mt-4 text-center text-[12px] text-ink-3">
        By continuing you agree to our{" "}
        <Link href="/terms" className="font-semibold text-pitch-dark hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold text-pitch-dark hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <PublicGames now={now} />
    </main>
  );
}

// Shared neutral pill for the OAuth options, so Google and Facebook stay
// pixel-identical and only differ by their brand icon + label.
function OAuthButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface font-semibold text-ink transition-colors hover:bg-surface-sunk active:scale-[0.99]"
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79v8.44C19.61 23.08 24 18.09 24 12.07Z"
      />
    </svg>
  );
}
