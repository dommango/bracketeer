import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getTeamDetail, type TeamDetail } from "@/lib/pool/team-detail";
import { roundLabel } from "@/lib/pool/rounds";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "../../Flag";

export const dynamic = "force-dynamic";

const LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function GroupTable({ detail }: { detail: TeamDetail }) {
  if (detail.table.length === 0) return null;
  return (
    <section>
      <h2 className={LABEL}>Group {detail.group}</h2>
      <div className="mt-2.5 overflow-hidden rounded-2xl border border-line bg-surface">
        {detail.table.map((r) => {
          const isTeam = r.code === detail.code;
          return (
            <div
              key={r.code}
              className={`grid grid-cols-[1.25rem_1fr_2.5rem_2.5rem_2.25rem] items-center gap-2 border-b border-line-soft px-3 py-2 text-sm last:border-b-0 ${
                isTeam ? "bg-pitch-tint/40 font-semibold text-ink" : "text-ink-2"
              }`}
            >
              <span className="font-mono text-xs text-ink-3">{r.rank}</span>
              <span className="flex min-w-0 items-center gap-2">
                <Flag code={r.code} size={16} />
                <span className="truncate">{r.code}</span>
              </span>
              <span className="text-right font-mono text-xs text-ink-3">{r.played}P</span>
              <span className="text-right font-mono text-xs tabular-nums text-ink-3">
                {r.gd >= 0 ? `+${r.gd}` : r.gd}
              </span>
              <span className="text-right font-display tabular-nums">{r.pts}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Fixtures({ detail, code }: { detail: TeamDetail; code: string }) {
  if (detail.fixtures.length === 0) return null;
  return (
    <section>
      <h2 className={LABEL}>Fixtures</h2>
      <ul className="mt-2.5 space-y-2">
        {detail.fixtures.map((m) => {
          const isHome = m.home.code === detail.code;
          const opp = isHome ? m.away : m.home;
          const teamSide = isHome ? m.home : m.away;
          // Show a score only once both are in — a just-kicked-off LIVE match can
          // have null scores, which would otherwise render as a bare "–".
          const decided =
            m.status !== "SCHEDULED" && teamSide.score !== null && opp.score !== null;
          const won = m.winnerCode === detail.code;
          return (
            <li key={m.matchNo}>
              <Link
                href={`/pool/${code}/matches/${m.matchNo}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-xs)] transition-colors hover:border-pitch"
              >
                <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">
                  {roundLabel(m.roundCode)}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-xs text-ink-3">{isHome ? "vs" : "@"}</span>
                  <Flag code={opp.code} size={18} />
                  <span className="min-w-0 truncate text-sm text-ink">{opp.name}</span>
                </span>
                {decided ? (
                  <span
                    className={`shrink-0 font-display text-sm tabular-nums ${won ? "text-pitch-dark" : "text-ink-3"}`}
                  >
                    {teamSide.score}–{opp.score}
                  </span>
                ) : (
                  <span className="shrink-0 font-mono text-[11px] text-ink-3">
                    {m.scheduledAt ? formatKickoff(m.scheduledAt) : "TBD"}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Backers({ detail, code }: { detail: TeamDetail; code: string }) {
  return (
    <section>
      <h2 className={LABEL}>
        Backed by
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          {detail.backers.length} {detail.backers.length === 1 ? "bracket" : "brackets"}
        </span>
      </h2>
      {detail.backers.length === 0 ? (
        <p className="mt-2.5 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
          No bracket in this pool staked {detail.name}.
        </p>
      ) : (
        <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
          {detail.backers.map((b) => (
            <li key={b.entryId}>
              <Link
                href={`/pool/${code}/u/${b.entryId}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-surface-sunk"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{b.label}</span>
                <span className="shrink-0 rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                  {b.as}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string; teamCode: string }>;
}) {
  const { code, teamCode } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const detail = await getTeamDetail(pool.id, pool.tournamentId, teamCode.toUpperCase());
  if (!detail) notFound();

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={LABEL}>Team</h2>
        <Link
          href={`/pool/${code}/matches`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← All matches
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <Flag code={detail.code} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl text-ink">{detail.name}</p>
          <p className="text-xs text-ink-3">
            {detail.group ? `Group ${detail.group}` : "—"} · {detail.code}
          </p>
        </div>
        {detail.odds ? (
          <span className="shrink-0 text-right">
            <span className="block font-display text-2xl tabular-nums text-ink">
              {Math.round(detail.odds.winProb * 100)}%
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
              to win
            </span>
          </span>
        ) : null}
      </div>

      <GroupTable detail={detail} />
      <Fixtures detail={detail} code={code} />
      <Backers detail={detail} code={code} />
    </section>
  );
}
