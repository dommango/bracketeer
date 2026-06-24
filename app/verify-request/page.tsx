import Link from "next/link";

// Branded "check your email" page for the magic-link flow. Auth.js redirects here
// after sending a sign-in link (wired via pages.verifyRequest in auth.ts). Using
// our own page instead of the built-in one avoids the Auth.js v5 UnknownAction
// ("Cannot handle action: verify-request") thrown when a custom pages.signIn is
// set but the built-in verify-request page is left to render the catch-all route.
export const dynamic = "force-dynamic";

export default function VerifyRequestPage() {
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
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">BRACKETEER · WORLD CUP 2026</p>
            <h1 className="mt-2.5 font-display text-2xl [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-white/90">
              We&apos;ve sent you a sign-in link. Open it on this device to finish signing in.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-3xl border border-line bg-surface p-6 text-sm text-ink-2">
        <p>
          The link is good for a single sign-in and expires shortly. If it doesn&apos;t arrive in a
          minute, check your spam folder.
        </p>
        <p className="text-ink-3">
          Wrong email or didn&apos;t get it?{" "}
          <Link href="/signin" className="font-semibold text-pitch-dark hover:underline">
            Try again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
