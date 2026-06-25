import Link from "next/link";
import type { PoolFormat } from "@/lib/pool/manage";
import { GAME_CATALOG, gameStateLine, prizeTeaser } from "@/lib/pool/games";

// The challenge shell hero — the public-board analogue of the pool layout header.
// Pitch-green panel with the brand pattern + scrim stack so text stays legible,
// driven entirely by the game catalog so copy can't drift from the pools/hub.
export function ChallengeHero({ format }: { format: PoolFormat }) {
  const game = GAME_CATALOG[format];
  const name = game.challengeName ?? game.poolName ?? "Challenge";
  const teaser = prizeTeaser(format);
  const stateLine = gameStateLine(format);

  return (
    <header className="relative overflow-hidden rounded-3xl bg-pitch p-6 text-white shadow-[var(--shadow-md)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/brand-26-pattern.avif)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.34)" }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(155deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0) 70%), linear-gradient(0deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 35%)",
        }}
      />
      <div className="relative">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-white/85 underline-offset-2 hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
        >
          <span aria-hidden="true">←</span> Bracketeer
        </Link>
        <div
          className="mt-3 inline-block min-w-0 max-w-full rounded-2xl px-4 py-3"
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold">
            Public challenge
          </p>
          <h1 className="mt-1 break-words font-display text-[28px] leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            {name}
          </h1>
          <p className="mt-1.5 text-sm text-white/90">
            {game.tagline}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
            style={{
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.28)",
            }}
          >
            {stateLine}
          </span>
          {teaser ? (
            <span className="inline-flex items-center rounded-full bg-gold px-3 py-1 text-[12px] font-bold text-pitch-deep">
              🏆 {teaser}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
