import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { CUTOVER, cutoverAppliesTo, cutoverSummary } from "@/lib/pool/cutover";
import { BracketsTabNav } from "../BracketsTabNav";

export const dynamic = "force-dynamic";

const ADOPTED = new Date(CUTOVER.generatedAt).toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const rankMove = (e: { rankDelta: number }) =>
  e.rankDelta > 0 ? `▲${e.rankDelta}` : e.rankDelta < 0 ? `▼${-e.rankDelta}` : "—";

// The pool's scoring statement: what "placement-agnostic knockout credit" means,
// why the commissioner adopted it, exactly what it does and doesn't change, and
// the full before/after board. Point values come from the engine's DEFAULT_SCORING
// and the numbers from the immutable cutover audit record, so this page can't
// drift from how brackets are actually scored.
export default async function PoolScoringPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  // The statement is specific to the pool the cutover record describes.
  const applies = cutoverAppliesTo(pool.id);
  const { gained, moved, total } = cutoverSummary();
  const leader = CUTOVER.entries.find((e) => e.afterRank === 1);

  return (
    <section className="space-y-5">
      <BracketsTabNav code={code} />

      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-lg text-ink">How scoring works</h1>
        <Link
          href={`/pool/${code}/leaderboard`}
          className="text-xs font-semibold text-pitch hover:underline"
        >
          Leaderboard →
        </Link>
      </div>

      {applies ? (
        <>
          <div className="rounded-2xl border border-gold/40 bg-gold-tint px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">
              Rule change · adopted {ADOPTED}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
              Knockout picks are now scored <span className="font-semibold text-ink">placement-agnostically</span>.
              You earn a round&apos;s points for any team you picked to win a match in that round that
              actually won a match in that round — even if it entered the bracket from a different
              slot than you seeded it. {gained} of {total} brackets gained points and {moved} changed
              rank.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              Why the change
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
              Before, a knockout pick only scored if your team won the exact bracket slot you placed
              it in. Seed a team as a group runner-up when it actually won its group, and it entered
              a different Round-of-32 slot than reality — so every round of its real run scored zero,
              even though you correctly backed it to go deep. Two people could back the same team to
              the same round and only one got the points, purely because of a group-stage placement.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
              Placement-agnostic credit fixes that: if you picked a team to win in a round and it won
              a match in that round, you get the points. The commissioner adopted it for the whole
              pool after reviewing the impact on every bracket.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              What stays exactly the same
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-3">
              <li>
                <span className="font-semibold text-ink-2">Group scoring</span> — unchanged. Exact
                position still scores {DEFAULT_SCORING.groupExact}, right team / wrong position or a
                correct third-place team still scores {DEFAULT_SCORING.groupPartial}.
              </li>
              <li>
                <span className="font-semibold text-ink-2">Round values</span> — unchanged. R32{" "}
                {DEFAULT_SCORING.r32}, R16 {DEFAULT_SCORING.r16}, QF {DEFAULT_SCORING.qf}, SF{" "}
                {DEFAULT_SCORING.sf}, Final {DEFAULT_SCORING.final}. Only which picks earn them
                changed.
              </li>
              <li>
                <span className="font-semibold text-ink-2">The third-place play-off</span> is still
                not scored, and <span className="font-semibold text-ink-2">player awards</span> are
                unchanged.
              </li>
              <li>
                <span className="font-semibold text-ink-2">The final</span> is a single slot, so it
                already worked this way — nothing about the champion pick changed.
              </li>
            </ul>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-xs)]">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                Before &amp; after
              </h2>
              {leader ? (
                <span className="text-[12px] text-ink-3">
                  Leader: <span className="font-semibold text-ink">{leader.label}</span> ({leader.afterTotal})
                </span>
              ) : null}
            </div>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-soft text-[11px] uppercase tracking-[0.06em] text-ink-4">
                  <th className="px-4 py-2 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">Contestant</th>
                  <th className="py-2 text-right font-semibold">Was</th>
                  <th className="py-2 text-right font-semibold">Now</th>
                  <th className="px-4 py-2 text-right font-semibold">Move</th>
                </tr>
              </thead>
              <tbody>
                {CUTOVER.entries.map((e) => (
                  <tr key={e.entryId} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2 font-mono tabular-nums text-ink-3">{e.afterRank}</td>
                    <td className="py-2 font-medium text-ink">
                      {e.label}
                      {e.pointsDelta > 0 ? (
                        <span className="ml-1.5 font-mono text-[11px] text-pitch-dark">
                          +{e.pointsDelta}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-ink-3">{e.beforeTotal}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold text-ink">
                      {e.afterTotal}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular-nums ${
                        e.rankDelta > 0 ? "text-pitch-dark" : e.rankDelta < 0 ? "text-ink-4" : "text-ink-4"
                      }`}
                    >
                      {rankMove(e)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-1 text-[12px] text-ink-3">
            &ldquo;Was&rdquo; is the final board under the old slot-based scoring, with the final
            already counted — so this table shows only the rule&apos;s effect. Prize and eligibility
            details are in the{" "}
            <Link href="/rules" className="font-semibold text-pitch-dark hover:underline">
              Official Rules
            </Link>
            .
          </p>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-6 text-center text-[13px] text-ink-3">
          This pool uses standard slot-based knockout scoring. Each correct knockout winner earns
          its round&apos;s points — R32 {DEFAULT_SCORING.r32}, R16 {DEFAULT_SCORING.r16}, QF{" "}
          {DEFAULT_SCORING.qf}, SF {DEFAULT_SCORING.sf}, Final {DEFAULT_SCORING.final}.
        </p>
      )}
    </section>
  );
}
