"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";

// The challenge shell's bottom nav — the public-board analogue of the pool
// BottomNav, sharing its active treatment (gold top accent + pitch-tint pill +
// pitch-dark label). The base path is derived from the active challenge segment
// (/challenge/md3 or /challenge/knockout), so the same nav serves both games.
type Tab = {
  key: string;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
};

// The challenge segment immediately after /challenge ("md3" | "knockout"), or
// null on the bare /challenge index.
export function challengeBaseFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/challenge\/(md3|knockout)(?:\/|$)/);
  return m ? `/challenge/${m[1]}` : null;
}

export function ChallengeBottomNav() {
  const pathname = usePathname() ?? "";
  const base = challengeBaseFromPath(pathname);
  // No bottom nav on the bare /challenge index (it redirects); render nothing.
  if (!base) return null;

  const tabs: Tab[] = [
    {
      key: "home",
      label: "Home",
      href: base,
      isActive: (p) => p === base,
      icon: <HomeGlyph />,
    },
    {
      key: "leaderboard",
      label: "Board",
      href: `${base}/leaderboard`,
      isActive: (p) => p === `${base}/leaderboard` || p.startsWith(`${base}/u/`),
      icon: <BoardGlyph />,
    },
    {
      key: "matches",
      label: "Matches",
      href: `${base}/matches`,
      isActive: (p) => p === `${base}/matches` || p.startsWith(`${base}/matches/`),
      icon: <MatchesGlyph />,
    },
  ];

  return (
    <nav
      aria-label="Challenge"
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
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute left-1/2 top-0 h-[3px] -translate-x-1/2 rounded-b-full bg-gold",
                    "transition-[width,opacity] duration-[var(--dur-3)] [transition-timing-function:var(--ease-standard)]",
                    "motion-reduce:transition-none",
                    active ? "w-7 opacity-100" : "w-0 opacity-0",
                  ].join(" ")}
                />
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

/* Icons — 22px, 1.75 stroke, currentColor (matching the pool BottomNav). */
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
  return (
    <svg {...svgProps}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function BoardGlyph() {
  // Podium — the standings board.
  return (
    <svg {...svgProps}>
      <path d="M9 13H4v7h5z" />
      <path d="M14.5 8h-5v12h5z" />
      <path d="M20 11h-5v9h5z" />
    </svg>
  );
}

function MatchesGlyph() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 6.5 4.5 3.3-1.7 5.3H9.2L7.5 9.8 12 6.5Z" />
      <path d="M12 6.5V3.5M16.5 9.8 19.4 8M14.8 15.1 17 19M9.2 15.1 7 19M7.5 9.8 4.6 8" />
    </svg>
  );
}
