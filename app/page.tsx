import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <div className="rounded-3xl bg-pitch text-white p-8 shadow-lg">
        <p className="text-gold font-semibold tracking-wide uppercase text-sm">HessFest</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight">
          Run a World Cup 2026 pool with your friends.
        </h1>
        <p className="mt-3 text-white/80">
          Live scores, a realtime leaderboard, and group chat — all in one place.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-lg">Have a join code?</h2>
        <p className="text-black/60 text-sm mt-1">
          Open your pool by visiting <code className="rounded bg-black/5 px-1.5 py-0.5">/pool/CODE</code>.
        </p>
        <Link
          href="/pool/FIXTUR"
          className="mt-4 inline-flex items-center rounded-full bg-pitch px-5 py-2.5 text-white font-medium hover:bg-pitch-dark transition"
        >
          View the demo pool →
        </Link>
      </div>
    </main>
  );
}
