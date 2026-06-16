import type { MatchDetail } from "@/lib/pool/queries";
import type { LineupPlayer } from "@/lib/sports/lineups-parse";
import { Flag } from "../../Flag";

const SECTION_LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function TeamColumn({
  side,
  formation,
  players,
  align,
}: {
  side: MatchDetail["home"];
  formation: string | null;
  players: LineupPlayer[];
  align: "left" | "right";
}) {
  const right = align === "right";
  return (
    <div className={right ? "text-right" : "text-left"}>
      <div className={`mb-2 flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <Flag code={side.code} size={18} />
        <span className="font-mono text-xs font-semibold text-ink-2">{side.code}</span>
        {formation ? (
          <span className="font-mono text-[11px] text-ink-3">{formation}</span>
        ) : null}
      </div>
      <ul className="space-y-1">
        {players.map((p, i) => (
          <li
            key={`${p.number}-${p.name}-${i}`}
            className={`flex items-baseline gap-1.5 text-[13px] ${right ? "flex-row-reverse" : ""}`}
          >
            <span className="w-5 shrink-0 font-mono tabular-nums text-ink-4">
              {p.number ?? ""}
            </span>
            <span className="min-w-0 truncate text-ink">{p.name ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Starting XI + formation per team, side by side. Renders nothing until the
// lineups poll has data (lineups publish ~1h before kickoff).
export function MatchLineups({
  lineup,
  home,
  away,
}: {
  lineup: MatchDetail["lineup"];
  home: MatchDetail["home"];
  away: MatchDetail["away"];
}) {
  if (!lineup || (lineup.home.length === 0 && lineup.away.length === 0)) return null;
  return (
    <section>
      <h3 className={`mb-2 ${SECTION_LABEL}`}>Lineups</h3>
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface p-4">
        <TeamColumn
          side={home}
          formation={lineup.homeFormation}
          players={lineup.home}
          align="left"
        />
        <TeamColumn
          side={away}
          formation={lineup.awayFormation}
          players={lineup.away}
          align="right"
        />
      </div>
    </section>
  );
}
