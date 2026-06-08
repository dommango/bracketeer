import type { BracketView, BracketMatch } from "@/lib/pool/bracket-view";

function Side({
  name,
  code,
  score,
  isWinner,
  decided,
}: {
  name: string;
  code: string | null;
  score: number | null;
  isWinner: boolean;
  decided: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        decided && !isWinner ? "text-black/40" : "text-black"
      }`}
    >
      <span className={`truncate ${isWinner ? "font-bold" : "font-medium"}`}>
        {name}
        {code ? <span className="ml-1 text-[10px] text-black/30">{code}</span> : null}
      </span>
      {score !== null ? <span className="tabular-nums text-sm">{score}</span> : null}
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatch }) {
  const decided = Boolean(m.winnerCode);
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
      <Side
        name={m.home}
        code={m.homeCode}
        score={m.homeScore}
        isWinner={decided && m.winnerCode === m.homeCode}
        decided={decided}
      />
      <div className="my-1 h-px bg-black/5" />
      <Side
        name={m.away}
        code={m.awayCode}
        score={m.awayScore}
        isWinner={decided && m.winnerCode === m.awayCode}
        decided={decided}
      />
    </div>
  );
}

export function Bracket({ view }: { view: BracketView }) {
  return (
    <div className="space-y-5">
      {view.rounds.map((round) => (
        <div key={round.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
            {round.label}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {round.matches.map((m) => (
              <MatchCard key={m.matchNo} m={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GroupStandings({ view }: { view: BracketView }) {
  const anySet = view.groups.some((g) => g.first || g.second) || view.thirds.length > 0;
  if (!anySet) {
    return (
      <p className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-black/50">
        Group standings will appear here once the group stage is decided.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.groups.map((g) => (
          <div key={g.group} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Group {g.group}
            </p>
            <p className="mt-1">
              <span className="text-black/40">1.</span> {g.first ?? "—"}
            </p>
            <p>
              <span className="text-black/40">2.</span> {g.second ?? "—"}
            </p>
          </div>
        ))}
      </div>
      {view.thirds.length > 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Third-place advancers
          </p>
          <p className="mt-1">{view.thirds.join(" · ")}</p>
        </div>
      ) : null}
    </div>
  );
}
