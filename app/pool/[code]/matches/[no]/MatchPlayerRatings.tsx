import type { MatchDetail } from "@/lib/pool/queries";
import type { PlayerStatLine } from "@/lib/sports/fixture-players-parse";
import { Flag } from "../../Flag";

const SECTION_LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function RatingPill({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="w-9 shrink-0" />;
  // Strong / solid / quiet — a quick visual scan of who performed.
  const tone =
    rating >= 7.5
      ? "bg-pitch text-white"
      : rating >= 6.5
        ? "bg-gold-tint text-gold-dark"
        : "bg-surface-sunk text-ink-2";
  return (
    <span
      className={`w-9 shrink-0 rounded-md py-0.5 text-center font-mono text-[11px] font-bold tabular-nums ${tone}`}
    >
      {rating.toFixed(1)}
    </span>
  );
}

function RatedColumn({
  side,
  players,
  align,
}: {
  side: MatchDetail["home"];
  players: PlayerStatLine[];
  align: "left" | "right";
}) {
  const right = align === "right";
  const ranked = players
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (ranked.length === 0) return null;
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`mb-2 flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <Flag code={side.code} size={18} />
        <span className="font-mono text-xs font-semibold text-ink-2">{side.code}</span>
      </div>
      <ul className="space-y-1">
        {ranked.map((p, i) => (
          <li
            key={`${p.number}-${p.name}-${i}`}
            className={`flex items-center gap-1.5 text-[13px] ${right ? "flex-row-reverse" : ""}`}
          >
            <RatingPill rating={p.rating} />
            <span className="min-w-0 truncate text-ink">{p.name ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Player of the Match + per-team match ratings, side by side. Renders nothing until
// the player feed has data (ratings publish in-play and finalize at full time).
export function MatchPlayerRatings({
  playerRatings,
  playerOfMatch,
  home,
  away,
}: {
  playerRatings: MatchDetail["playerRatings"];
  playerOfMatch: MatchDetail["playerOfMatch"];
  home: MatchDetail["home"];
  away: MatchDetail["away"];
}) {
  const hasRatings =
    playerRatings &&
    (playerRatings.home.some((p) => p.rating != null) ||
      playerRatings.away.some((p) => p.rating != null));
  if (!hasRatings) return null;
  return (
    <section>
      <h3 className={`mb-2 ${SECTION_LABEL}`}>Player ratings</h3>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {playerOfMatch ? (
          <div className="flex items-center gap-2 rounded-xl bg-pitch-tint px-3 py-2">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
              ⭐ Player of the match
            </span>
            <Flag code={playerOfMatch.teamCode} size={16} />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
              {playerOfMatch.name}
            </span>
            <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-pitch-dark">
              {playerOfMatch.rating.toFixed(1)}
            </span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <RatedColumn side={home} players={playerRatings!.home} align="left" />
          <RatedColumn side={away} players={playerRatings!.away} align="right" />
        </div>
      </div>
    </section>
  );
}
