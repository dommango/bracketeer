"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Two-tab switcher between the public challenge boards (Knockout / Match Day).
const TABS = [
  { href: "/challenge", label: "Knockout" },
  { href: "/challenge/md3", label: "Match Day" },
];

export function ChallengeTabs() {
  const pathname = usePathname();
  // Most-specific match wins so the Match Day tab stays highlighted on its nested
  // /challenge/md3/play form — a plain `pathname === href` leaves both tabs inactive there.
  const activeHref = TABS.filter(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="mb-5 flex gap-1 rounded-full border border-line bg-surface-sunk p-1">
      {TABS.map((t) => {
        const active = t.href === activeHref;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-semibold transition-colors ${
              active ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
