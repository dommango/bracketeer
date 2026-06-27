"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hero } from "./Hero";
import { availableHeroSlides } from "@/lib/pool/hero-slides";

const ADVANCE_MS = 5000;

// Cycles the available game slides over the shared hero visual shell. `now` comes
// from the server parent so the initial slide set is deterministic across SSR and
// hydration. Degrades safely: no live games → the static marketing <Hero/>; a
// single game → no dots and no auto-advance.
export function HeroCarousel({ now }: { now: Date }) {
  const slides = availableHeroSlides(now);
  const count = slides.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count === 0) return <Hero />;

  const slide = slides[Math.min(index, count - 1)];

  return (
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
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)" }}
      />
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
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-gold">{slide.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-[28px] leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
            {/* Full-bleed click target over the panel; dots sit above via z-10. */}
            <Link href={slide.href} className="after:absolute after:inset-0 hover:underline">
              {slide.headline}
            </Link>
          </h1>
          {/* Kept inside the frosted plate (not over the bright artwork) so it stays legible. */}
          <p className="mt-2 text-[13px] font-semibold text-white/95">{slide.stateLine}</p>
        </div>
        {count > 1 ? (
          <div className="relative z-10 mt-4 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.format}
                type="button"
                aria-label={`Show ${s.headline}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
