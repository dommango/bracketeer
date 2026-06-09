import { redirect } from "next/navigation";

// Marketing splash + join-code entry. The join box is a server action that
// redirects to /pool/CODE — no client JS needed.
async function openPool(formData: FormData) {
  "use server";
  const code = String(formData.get("code") || "").trim().toUpperCase().slice(0, 6);
  redirect(`/pool/${code || "FIXTUR"}`);
}

export default function Home() {
  return (
    <main className="mx-auto max-w-[480px] px-5 pb-8 pt-12">
      {/* Hero — FIFA 26 pattern behind a pitch-green scrim. */}
      <div className="relative overflow-hidden rounded-[32px] bg-pitch p-8 text-white shadow-[var(--shadow-lg)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/brand-26-pattern.avif)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.45,
            mixBlendMode: "luminosity",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,107,58,0.4) 0%, rgba(5,48,25,0.95) 100%)",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">HessFest</p>
          <h1 className="mt-2.5 font-display text-[34px] leading-[1.02]">
            Run a World Cup 2026 pool with your friends.
          </h1>
          <p className="mt-3.5 text-sm text-white/80">
            Live scores, a realtime leaderboard, and group chat — all in one place.
          </p>
          <div className="mt-[18px] flex gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
            <span>48 teams</span>
            <span>·</span>
            <span>104 matches</span>
            <span>·</span>
            <span>June 11</span>
          </div>
        </div>
      </div>

      {/* Join code */}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-[22px]">
        <h2 className="font-display text-lg text-ink">Have a join code?</h2>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Enter the 6-letter code your pool admin shared with you.
        </p>
        <form action={openPool} className="mt-4 flex gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-[18px] focus-within:border-pitch focus-within:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]">
            <span className="font-mono font-bold text-ink-3">#</span>
            <input
              name="code"
              maxLength={6}
              placeholder="FIXTUR"
              autoCapitalize="characters"
              className="min-w-0 flex-1 bg-transparent text-[15px] uppercase tracking-wide text-ink outline-none placeholder:normal-case"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.97]"
          >
            Open
          </button>
        </form>
        <a
          href="/pool/FIXTUR"
          className="mt-3.5 block rounded-full p-2.5 text-center text-[13px] font-semibold text-pitch-dark hover:bg-surface-sunk"
        >
          View the demo pool →
        </a>
      </div>

      <div className="mt-7 flex justify-center gap-2 text-[11px] text-ink-3">
        <span>FIFA World Cup 26™</span>
        <span>·</span>
        <span>Pool MVP · Kickoff Jun 11, 2026</span>
      </div>
    </main>
  );
}
