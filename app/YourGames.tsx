import Link from "next/link";

export interface YourGame {
  name: string;
  // A short status line, e.g. "2 in the Challenge" or "Your predictions".
  detail: string;
  href: string;
}

// The public challenges the signed-in user is already playing, listed right after
// login so returning players land on a clear "your games" hub instead of a generic
// promo. Pools are listed separately ("Your pools"); games the user could still
// join are promoted below in PublicGames. Renders nothing when the user plays none.
export function YourGames({ games }: { games: YourGame[] }) {
  if (games.length === 0) return null;
  return (
    <section className="mt-4">
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Your games</p>
      <ul className="mt-2 space-y-2">
        {games.map((g) => (
          <li key={g.href}>
            <Link
              href={g.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{g.name}</span>
                <span className="text-[13px] text-ink-3">{g.detail}</span>
              </span>
              <span className="font-display text-pitch-dark">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
