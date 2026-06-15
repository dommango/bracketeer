import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { googleEnabled, emailEnabled } from "@/lib/env";

// Server component sign-in. No client JS: each option is a server action that
// hands off to Auth.js, which performs the redirect.
export const dynamic = "force-dynamic";

// Only same-origin relative paths are honored as a post-sign-in destination, so
// a crafted ?callbackUrl can't turn sign-in into an open redirect. Reject
// protocol-relative (`//host`) and backslash forms (`/\host`, `/\/host`) —
// browsers fold `\` to `/`, so those would otherwise resolve off-site.
function safeCallback(raw: unknown): string {
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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error, callbackUrl } = await searchParams;
  const dest = safeCallback(callbackUrl ?? "/");

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-8 pt-12">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">BRACKETEER × FIFA WC 2026</p>
            <h1 className="mt-2.5 font-display text-2xl [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-white/90">
              Sign in to claim your bracket and join the chat.
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
        {googleEnabled ? (
          <form action={googleSignIn}>
            <input type="hidden" name="callbackUrl" value={dest} />
            <button
              type="submit"
              className="h-11 w-full rounded-full border border-line bg-surface font-semibold text-ink transition-colors hover:bg-surface-sunk active:scale-[0.99]"
            >
              Continue with Google
            </button>
          </form>
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
    </main>
  );
}
