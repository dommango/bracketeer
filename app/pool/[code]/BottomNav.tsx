"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";

// Designed in Claude Design (handoff bundle "nav-bar"); wired to the real pool
// routes here. Active treatment: gold top accent (gold = winning state only) +
// a pitch-tint pill behind the icon + pitch-dark label — two reinforcing cues.
// Home matches exactly; Brackets and Matches each light up across a family of
// related routes (a tab is a section, not a single page).

type TabKey = "home" | "brackets" | "matches";

type Tab = {
  key: TabKey;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
};

export function BottomNav({ code }: { code: string }) {
  const pathname = usePathname() ?? "";
  const base = `/pool/${code}`;
  // A tab stays lit across every route in its section. Match a path against any
  // of the section's hrefs (exact, or a nested child under `${href}/`).
  const anyPrefix = (hrefs: string[]) => (p: string) =>
    hrefs.some((h) => p === h || p.startsWith(`${h}/`));

  const tabs: Tab[] = [
    {
      key: "home",
      label: "Home",
      href: base,
      isActive: (p) => p === base,
      icon: <HomeGlyph />,
    },
    {
      key: "brackets",
      label: "Brackets",
      href: `${base}/brackets`,
      // The contestant-centric section: hub, your picks, contestants
      // (leaderboard + profiles), and the compare tool.
      isActive: anyPrefix([
        `${base}/brackets`,
        `${base}/picks`,
        `${base}/compare`,
        `${base}/leaderboard`,
        `${base}/u`,
      ]),
      icon: <BracketGlyph />,
    },
    {
      key: "matches",
      label: "Matches",
      href: `${base}/matches`,
      // Fixtures + folded-in scorers, plus the Phase-2 team/player drill-downs.
      isActive: anyPrefix([
        `${base}/matches`,
        `${base}/scorers`,
        `${base}/teams`,
        `${base}/players`,
      ]),
      icon: <MatchesGlyph />,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-16 max-w-[480px] items-stretch">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <li key={tab.key} className="relative flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={[
                  "group relative flex h-full min-h-[44px] select-none flex-col items-center justify-center gap-1",
                  "outline-none focus-visible:bg-pitch-tint/60",
                  "transition-colors duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)]",
                  "motion-reduce:transition-none",
                  active ? "text-pitch" : "text-ink-3 hover:text-ink-2",
                ].join(" ")}
              >
                {/* Gold top accent — gold marks the active/winning state. */}
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute left-1/2 top-0 h-[3px] -translate-x-1/2 rounded-b-full bg-gold",
                    "transition-[width,opacity] duration-[var(--dur-3)] [transition-timing-function:var(--ease-standard)]",
                    "motion-reduce:transition-none",
                    active ? "w-7 opacity-100" : "w-0 opacity-0",
                  ].join(" ")}
                />
                {/* Pill behind the icon — softly fills on active. */}
                <span
                  className={[
                    "flex h-7 w-10 items-center justify-center rounded-full",
                    "transition-colors duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)]",
                    "motion-reduce:transition-none",
                    active ? "bg-pitch-tint" : "bg-transparent",
                  ].join(" ")}
                >
                  {tab.icon}
                </span>
                <span
                  className={[
                    "text-[10px] font-bold uppercase leading-none tracking-[0.12em] tabular-nums",
                    active ? "text-pitch-dark" : "text-ink-3",
                  ].join(" ")}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ────────────────────────────────────────────────────────────
   Icons — 22px, 1.75 stroke, currentColor. Read at glance.
   ──────────────────────────────────────────────────────────── */

const svgProps: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

function HomeGlyph() {
  // House — the personal dashboard landing.
  return (
    <svg {...svgProps}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function MatchesGlyph() {
  // Stylized ball — circle with the center panel pentagon.
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 6.5 4.5 3.3-1.7 5.3H9.2L7.5 9.8 12 6.5Z" />
      <path d="M12 6.5V3.5M16.5 9.8 19.4 8M14.8 15.1 17 19M9.2 15.1 7 19M7.5 9.8 4.6 8" />
    </svg>
  );
}

function BracketGlyph() {
  // Single-elimination bracket: four seeds on the left fold into two semis, then
  // the final spine, ending at the champion node on the right.
  return (
    <svg {...svgProps}>
      {/* top pair → upper semi */}
      <path d="M3 4h3M3 10h3M6 4v6M6 7h3" />
      {/* bottom pair → lower semi */}
      <path d="M3 14h3M3 20h3M6 14v6M6 17h3" />
      {/* final spine: the two semis meet and run out to the champion node */}
      <path d="M9 7v10M9 12h5" />
      <circle cx="17.5" cy="12" r="2" />
    </svg>
  );
}
