import Link from "next/link";
import { scoreMd3 } from "@/lib/pool/match-day-3";
import { DAILY_ADVANCE_BONUS } from "@/lib/games/daily-pickem/score-knockout";
import { KNOCKOUT_ROUND_WEIGHT, PERFECT_DAY_BASE } from "@/lib/games/daily-pickem/ladder";
import { roundLabel, type RoundCode } from "@/lib/pool/rounds";
import { ROUND_ACCENT } from "@/lib/pool/bracket-tree";
import type { Stage } from "@/lib/games/stage";

// How scoring works for the knockout Match Day Pick'em — the round-weighted ladder
// shipped in PR #125. Every number here is derived from the real engine so the page
// can't drift: the scoreline tiers come from scoreMd3 (probed with representative
// lines, mirroring how the knockout page reads DEFAULT_SCORING), the advancement
// bonus from DAILY_ADVANCE_BONUS, the round multipliers from KNOCKOUT_ROUND_WEIGHT,
// and the clean-sweep base from PERFECT_DAY_BASE.

// Scoreline tiers, probed from scoreMd3 so they always match the live scorer.
const LINE_EXACT = scoreMd3({ home: 2, away: 1 }, { home: 2, away: 1 }); // exact score
const LINE_DIFF = scoreMd3({ home: 2, away: 1 }, { home: 3, away: 2 }); // result + goal diff
const LINE_RESULT = scoreMd3({ home: 2, away: 0 }, { home: 1, away: 0 }); // result only
const LINE_WRONG = scoreMd3({ home: 2, away: 1 }, { home: 0, away: 2 }); // wrong result

// Round-weight ladder: fixed bracket shape (16 → 8 → 4 → 2 → 1) paired with the
// engine's per-round multipliers. The weights double each round to offset the
// bracket's halving, so every round's point pool is ~equal and one Final pick is
// worth 16 R32 picks — keeping comebacks alive to the Final.
const ROUNDS: { code: RoundCode; stage: Stage; matches: number }[] = [
  { code: "R32", stage: "R32", matches: 16 },
  { code: "R16", stage: "R16", matches: 8 },
  { code: "QF", stage: "QF", matches: 4 },
  { code: "SF", stage: "SF", matches: 2 },
  { code: "FINAL", stage: "FINAL", matches: 1 },
];

const TOTAL_MATCHES = ROUNDS.reduce((sum, r) => sum + r.matches, 0);
// Max points a single pick can earn before weighting: exact line + advancer bonus.
const MAX_PER_PICK = LINE_EXACT + DAILY_ADVANCE_BONUS;

const pts = (n: number) => `${n} pt${n === 1 ? "" : "s"}`;

const LINES: { label: string; example: string; points: number }[] = [
  { label: "Exact scoreline", example: "predict 2–1, it finishes 2–1", points: LINE_EXACT },
  { label: "Right result & goal difference", example: "predict 2–1, it finishes 3–2", points: LINE_DIFF },
  { label: "Right result only", example: "predict 2–0, it finishes 1–0", points: LINE_RESULT },
  { label: "Wrong result", example: "predict 2–1, it finishes 0–2", points: LINE_WRONG },
];

export default function DailyKnockoutScoringPage() {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-lg text-ink">How scoring works</h1>
        <Link href="/challenge/md3" className="text-xs font-semibold text-pitch hover:underline">
          Home →
        </Link>
      </div>

      <p className="px-1 text-[13px] leading-relaxed text-ink-3">
        Predict the final score of every knockout match, from the Round of 32 to the final. Each
        pick earns points for how close your scoreline is, plus a bonus for backing the team that
        advances — and later rounds are weighted heavier, so the deep runs decide the leaderboard
        across all {TOTAL_MATCHES} knockout fixtures.
      </p>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Points per pick
        </h2>
        <ul className="mt-3 space-y-2.5">
          {LINES.map((l) => (
            <li key={l.label} className="flex items-baseline gap-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{l.label}</span>
                <span className="block text-[12px] text-ink-3">{l.example}</span>
              </span>
              <span className="w-14 shrink-0 text-right font-display text-base tabular-nums text-ink">
                {pts(l.points)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line-soft pt-3 text-[12px] leading-relaxed text-ink-3">
          Then, if the team you had winning is the one that actually goes through, you earn a{" "}
          <span className="font-semibold text-ink-2">+{DAILY_ADVANCE_BONUS} advancer bonus</span> on
          top — so a perfect pick is worth {pts(MAX_PER_PICK)}. A predicted draw backs no advancer
          (knockouts are settled on penalties), and shootout digits aren&apos;t scored.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          The round-weighted ladder
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Each pick&apos;s points are multiplied by its round&apos;s weight. The weights double every
          round to offset the bracket halving, so every round is worth chasing and one Final pick is
          worth sixteen Round-of-32 picks.
        </p>
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
                ×{KNOCKOUT_ROUND_WEIGHT[r.stage]}
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
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Crowns & bonuses</h2>
        <ul className="mt-3 space-y-3">
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="text-base leading-5">👑</span>
            <span className="text-[13px] leading-relaxed text-ink-3">
              <span className="font-semibold text-ink-2">Round champion</span> — top the weighted
              points for a whole round (R32 → Final) and you wear the crown on that round&apos;s board.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="text-base leading-5">🏆</span>
            <span className="text-[13px] leading-relaxed text-ink-3">
              <span className="font-semibold text-ink-2">Day winner</span> — top the weighted points
              on a single match-day to take that day&apos;s crown.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="text-base leading-5">✨</span>
            <span className="text-[13px] leading-relaxed text-ink-3">
              <span className="font-semibold text-ink-2">Perfect day</span> — score on every fixture
              of a day with two or more matches to earn a clean-sweep bonus of{" "}
              <span className="font-semibold text-ink-2">{PERFECT_DAY_BASE} × the round weight</span>.
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4">
        <p className="text-[13px] leading-relaxed text-ink-3">
          Each fixture locks at its own kickoff, so you can keep editing later matches after earlier
          ones start. Make your picks to climb the ladder.
        </p>
        <Link
          href="/challenge/md3/play"
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-pitch px-4 text-sm font-semibold text-white hover:bg-pitch-dark"
        >
          Make your picks →
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
