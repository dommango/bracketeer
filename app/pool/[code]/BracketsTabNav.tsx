"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Lateral sub-nav for the Brackets section. Mirrors the pill toggle on the
// Matches page. Contestants covers both the leaderboard list and the per-entry
// profile pages it links to.
type SubKey = "picks" | "contestants" | "compare";

export function BracketsTabNav({ code }: { code: string }) {
  const pathname = usePathname() ?? "";
  const base = `/pool/${code}`;

  const active: SubKey | null = pathname.startsWith(`${base}/picks`)
    ? "picks"
    : pathname.startsWith(`${base}/compare`)
      ? "compare"
      : pathname.startsWith(`${base}/leaderboard`) || pathname.startsWith(`${base}/u/`)
        ? "contestants"
        : null;

  const tab = (key: SubKey, href: string, label: string) => {
    const on = active === key;
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition-colors ${
          on ? "bg-pitch text-white shadow-[var(--shadow-xs)]" : "text-ink-2 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface-sunk p-1">
      {tab("picks", `${base}/picks`, "My Bracket")}
      {tab("contestants", `${base}/leaderboard`, "Leaderboard")}
      {tab("compare", `${base}/compare`, "Compare")}
    </div>
  );
}
