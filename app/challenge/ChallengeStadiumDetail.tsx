import Link from "next/link";
import type { MatchCenterSection } from "@/lib/pool/match-center";
import type { Stadium } from "@/lib/pool/stadiums";
import { MatchCenter } from "@/app/pool/[code]/MatchCenter";

// Venue drill-down for the public challenges — the games at one host city,
// rendered as the same live Match-Center scorecards used elsewhere. The caller
// resolves the stadium + the tournament-scoped venue rows; cards drill into the
// challenge match-detail via `basePath`.
export function ChallengeStadiumDetail({
  stadium,
  sections,
  basePath,
}: {
  stadium: Stadium;
  sections: MatchCenterSection[];
  basePath: string;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          href={`${basePath}/matches`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          ← All matches
        </Link>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: `var(--city-${stadium.token})` }}
          />
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{stadium.city}</p>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink">{stadium.venue}</h1>
        <p className="text-sm text-ink-3">
          {stadium.matches.length} {stadium.matches.length === 1 ? "game" : "games"}
        </p>
      </header>

      <MatchCenter sections={sections} hrefForMatch={(no) => `${basePath}/matches/${no}`} />
    </div>
  );
}
