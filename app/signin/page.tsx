import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { googleEnabled, emailEnabled } from "@/lib/env";

// Server component sign-in. No client JS: each option is a server action that
// hands off to Auth.js, which performs the redirect.
export const dynamic = "force-dynamic";

async function emailSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email) return;
  await signIn("nodemailer", { email, redirectTo: "/" });
}

async function googleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <div className="rounded-3xl bg-pitch text-white p-8 shadow-lg">
        <p className="text-gold font-semibold tracking-wide uppercase text-sm">HessFest</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-white/80 text-sm">
          Sign in to claim your bracket and join the chat.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Sign-in failed ({error}). Please try again.
        </p>
      ) : null}

      <div className="mt-6 space-y-4 rounded-2xl border border-black/10 bg-white p-6">
        {googleEnabled ? (
          <form action={googleSignIn}>
            <button
              type="submit"
              className="w-full rounded-full border border-black/15 bg-white px-5 py-2.5 font-medium hover:bg-black/5 transition"
            >
              Continue with Google
            </button>
          </form>
        ) : null}

        <form action={emailSignIn} className="space-y-3">
          <label className="block text-sm font-medium text-black/70" htmlFor="email">
            Email magic link
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-black/15 px-4 py-2.5 outline-none focus:border-pitch"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-pitch px-5 py-2.5 text-white font-medium hover:bg-pitch-dark transition"
          >
            Email me a sign-in link
          </button>
          {!emailEnabled ? (
            <p className="text-xs text-black/50">
              Email delivery is not configured — the magic link is printed to the server console
              for local development.
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
