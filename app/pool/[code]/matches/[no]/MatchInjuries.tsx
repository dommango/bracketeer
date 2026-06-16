import type { MatchDetail } from "@/lib/pool/queries";
import type { InjuryItem } from "@/lib/sports/injuries-parse";
import { Flag } from "../../Flag";

const SECTION_LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// One side's absentees: player name + the reason/availability when known.
function TeamColumn({ side, items }: { side: MatchDetail["home"]; items: InjuryItem[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Flag code={side.code} size={16} />
        <span className="truncate text-xs font-semibold text-ink-2">{side.name}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-4">None reported</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => {
            // API-Football flags doubtful players as "Questionable"; everything
            // else ("Missing Fixture") is a confirmed absence.
            const doubtful = (it.type ?? "").toLowerCase().includes("question");
            return (
              <li key={`${it.playerName}-${i}`} className="text-xs leading-tight">
                <span className="text-ink">{it.playerName}</span>
                {doubtful ? (
                  <span className="ml-1 align-middle text-[9px] font-bold uppercase text-warning">
                    doubtful
                  </span>
                ) : null}
                {it.reason ? <span className="block text-[10px] text-ink-4">{it.reason}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// "Key absentees" — injured / suspended players per side. Buckets the flat injury
// list by the match's resolved team codes. Renders nothing until the poll has data.
export function MatchInjuries({
  injuries,
  home,
  away,
}: {
  injuries: MatchDetail["injuries"];
  home: MatchDetail["home"];
  away: MatchDetail["away"];
}) {
  if (injuries.length === 0) return null;
  const homeItems = injuries.filter((it) => it.teamCode === home.code);
  const awayItems = injuries.filter((it) => it.teamCode === away.code);

  return (
    <section>
      <h3 className={`mb-2 ${SECTION_LABEL}`}>Key absentees</h3>
      <div className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
        <TeamColumn side={home} items={homeItems} />
        <div className="w-px shrink-0 bg-line-soft" />
        <TeamColumn side={away} items={awayItems} />
      </div>
    </section>
  );
}
