import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPlayerDetail, type PlayerDetail } from "@/lib/pool/player-detail";
import { roundLabel } from "@/lib/pool/rounds";
import { Flag } from "../../Flag";
import { TeamLink } from "../../TeamLink";

export const dynamic = "force-dynamic";

const LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function minuteLabel(minute: number, extra: number | null): string {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function Goals({ detail, code }: { detail: PlayerDetail; code: string }) {
  if (detail.goalEvents.length === 0) return null;
  return (
    <section>
      <h2 className={LABEL}>
        Goals
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          {detail.goalEvents.length}
        </span>
      </h2>
      <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
        {detail.goalEvents.map((g, i) => (
          <li key={`${g.matchNo}-${g.minute}-${i}`}>
            <Link
              href={`/pool/${code}/matches/${g.matchNo}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-sunk"
            >
              <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pitch-dark">
                {minuteLabel(g.minute, g.extraMinute)}
              </span>
              <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">
                {roundLabel(g.roundCode)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-xs text-ink-3">vs</span>
                <Flag code={g.opponentCode} size={16} />
                <span className="min-w-0 truncate text-sm text-ink">{g.opponentCode ?? "—"}</span>
              </span>
              {g.penalty ? (
                <span className="shrink-0 rounded-full bg-surface-sunk px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">
                  Pen
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; name: string }>;
}) {
  const { code, name: rawName } = await params;
  // A hand-crafted bad escape (e.g. "%E0%A4%A") would otherwise throw a 500.
  let name: string;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    notFound();
  }
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const detail = await getPlayerDetail(pool.tournamentId, name);
  if (!detail) notFound();

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={LABEL}>Player</h2>
        <Link
          href={`/pool/${code}/matches?view=scorers`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← Golden Boot
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <TeamLink poolCode={code} code={detail.teamCode}>
          <Flag code={detail.teamCode} size={36} />
        </TeamLink>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl text-ink">{detail.name}</p>
          <p className="text-xs text-ink-3">
            {detail.teamName ? (
              <TeamLink poolCode={code} code={detail.teamCode} className="underline-offset-2 hover:underline">
                {detail.teamName}
              </TeamLink>
            ) : (
              "—"
            )}
            {detail.rank != null ? ` · #${detail.rank} top scorer` : ""}
          </p>
        </div>
        {detail.goals != null ? (
          <span className="shrink-0 text-right">
            <span className="block font-display text-3xl tabular-nums text-pitch-dark">
              {detail.goals}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
              {detail.goals === 1 ? "goal" : "goals"}
              {detail.assists != null ? ` · ${detail.assists}A` : ""}
            </span>
          </span>
        ) : null}
      </div>

      {detail.odds ? (
        <section>
          <h2 className={LABEL}>Golden Boot odds</h2>
          <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
            <span className="text-sm text-ink-2">Market-implied chance of finishing top scorer</span>
            <span className="shrink-0 font-display text-2xl tabular-nums text-pitch-dark">
              {Math.round(detail.odds.winProb * 100)}%
            </span>
          </div>
        </section>
      ) : null}

      <Goals detail={detail} code={code} />
    </section>
  );
}
