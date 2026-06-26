import Link from "next/link";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { roundLabel, type RoundCode } from "@/lib/pool/rounds";
import { ROUND_ACCENT } from "@/lib/pool/bracket-tree";

export const dynamic = "force-dynamic";

// How scoring works for the Knockout Challenge — the in-app explainer the Official
// Prize Rules defer to ("the scoring and tie-break rules shown in the app"). The
// per-round points come straight from the engine's DEFAULT_SCORING so this page
// can't drift from how brackets are actually scored. Match counts are the fixed
// bracket shape (32 → 16 → 8 → 4 → 2 → 1), summing to the 31 scored knockout
// winners. No awards: a knockout bracket is winners + the final-goals tiebreak.
const ROUNDS: { code: RoundCode; matches: number; points: number }[] = [
  { code: "R32", matches: 16, points: DEFAULT_SCORING.r32 },
  { code: "R16", matches: 8, points: DEFAULT_SCORING.r16 },
  { code: "QF", matches: 4, points: DEFAULT_SCORING.qf },
  { code: "SF", matches: 2, points: DEFAULT_SCORING.sf },
  { code: "FINAL", matches: 1, points: DEFAULT_SCORING.final },
];

const TOTAL_POINTS = ROUNDS.reduce((sum, r) => sum + r.matches * r.points, 0);
const TOTAL_MATCHES = ROUNDS.reduce((sum, r) => sum + r.matches, 0);

const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

export default function KnockoutScoringPage() {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-lg text-ink">How scoring works</h1>
        <Link href="/challenge/knockout" className="text-xs font-semibold text-pitch hover:underline">
          Home →
        </Link>
      </div>

      <p className="px-1 text-[13px] leading-relaxed text-ink-3">
        Pick the winner of every knockout match, from the Round of 32 to the final. Each correct
        winner earns points, and later rounds are worth more — so the deep runs decide the
        leaderboard. There are {TOTAL_POINTS} points up for grabs across {TOTAL_MATCHES} matches.
      </p>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Points per round</h2>
        <ul className="mt-3 space-y-2.5">
          {ROUNDS.map((r) => (
            <li key={r.code} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded"
                style={{ background: ROUND_ACCENT[r.code] ?? "var(--line)" }}
              />
              <span className="flex-1 font-medium text-ink">{roundLabel(r.code)}</span>
              <span className="font-mono text-[11px] tabular-nums text-ink-3">
                {r.matches} {r.matches === 1 ? "match" : "matches"}
              </span>
              <span className="w-14 text-right font-display text-base tabular-nums text-ink">
                {pts(r.points)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line-soft pt-3 text-[12px] text-ink-3">
          The third-place play-off isn&apos;t scored — only the matches on the path to the trophy
          count.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Tiebreaker</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          If two brackets finish level on points, the <span className="font-semibold text-ink-2">total
          goals in the final</span> breaks the tie — your guess closest to the real total ranks
          higher. Set it when you build your bracket.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4">
        <p className="text-[13px] leading-relaxed text-ink-3">
          Your bracket locks at the Round of 32 kickoff — after that, picks are final. Enter it into
          the Knockout Challenge to climb the global leaderboard.
        </p>
        <Link
          href="/bracket"
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-pitch px-4 text-sm font-semibold text-white hover:bg-pitch-dark"
        >
          Build your bracket →
        </Link>
      </div>

      <p className="px-1 text-[12px] text-ink-3">
        Prize and eligibility details are in the{" "}
        <Link href="/rules" className="font-semibold text-pitch-dark hover:underline">
          Official Rules
        </Link>
        .
      </p>
    </section>
  );
}
