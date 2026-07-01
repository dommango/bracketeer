import { HeroShell } from "./HeroShell";

// Shared marketing hero. The frosted plate hugs its (now single-line) copy and
// sits top-left, and the bottom-only darken is kept light, so the "26" + trophy
// in the centre of the brand artwork stay visible instead of being boxed out.
export function Hero() {
  return (
    <HeroShell overlay="bottom">
      <div className="relative">
        <div
          className="inline-block max-w-full rounded-2xl px-4 py-3"
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">BRACKETEER · WORLD CUP 2026</p>
          <h1 className="mt-1.5 font-display text-[28px] leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            2026 World Cup — Tournament Game
          </h1>
        </div>
        <div className="mt-4 flex gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
          <span>48 teams</span>
          <span>·</span>
          <span>104 matches</span>
          <span>·</span>
          <span>June 11 – July 19</span>
        </div>
      </div>
    </HeroShell>
  );
}
