import type { Profile as ProfileData, KnockoutHit, EntryProjectionView } from "@/lib/pool/profile";
import type { EntrySelections, TeamPick } from "@/lib/pool/pick-analytics";
import { ROUND_ORDER, roundLabel } from "@/lib/pool/rounds";
import { teamColor } from "@/lib/teams/colors";
import { Flag } from "./Flag";

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

const HIT_STYLE: Record<KnockoutHit["result"], { bg: string; border: string; text: string }> = {
  hit: { bg: "var(--positive)", border: "var(--positive)", text: "#fff" },
  miss: { bg: "var(--surface)", border: "var(--negative)", text: "var(--negative)" },
  pending: { bg: "var(--surface-sunk)", border: "var(--line)", text: "var(--ink-4)" },
};

function HitCell({ hit }: { hit: KnockoutHit }) {
  const s = HIT_STYLE[hit.result];
  const title =
    hit.result === "pending"
      ? `M${hit.matchNo} · your pick ${hit.pickName} · undecided`
      : `M${hit.matchNo} · your pick ${hit.pickName} · winner ${hit.winnerName}`;
  return (
    <span
      title={title}
      className="inline-flex h-9 w-11 flex-col items-center justify-center rounded-md border text-[10px] font-mono font-bold leading-none"
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      <span className="text-[9px] opacity-70">{hit.matchNo}</span>
      <span>{hit.pickCode ?? "—"}</span>
    </span>
  );
}

function HitGrid({ hits }: { hits: KnockoutHit[] }) {
  const byRound = new Map<string, KnockoutHit[]>();
  for (const h of hits) {
    const list = byRound.get(h.roundCode);
    if (list) list.push(h);
    else byRound.set(h.roundCode, [h]);
  }
  if (hits.length === 0) {
    return <p className="text-sm text-ink-3">No knockout results yet — check back once the bracket starts.</p>;
  }
  return (
    <div className="space-y-3">
      {ROUND_ORDER.filter((r) => byRound.has(r)).map((round) => (
        <div key={round}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            {roundLabel(round)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {byRound.get(round)!.map((h) => (
              <HitCell key={h.matchNo} hit={h} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamLine({ pick, size = 18 }: { pick: TeamPick; size?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <Flag code={pick.code} size={size} />
      <span className="truncate text-sm text-ink">{pick.name}</span>
    </span>
  );
}

// This entry's headline picks — only rendered once picks have locked.
function Selections({ selections }: { selections: EntrySelections }) {
  const { champion, finalists, groupWinners, thirdAdvance, awards } = selections;
  // Knockout brackets don't pick awards, so every value is "—" — hide the whole
  // section rather than show a block of dashes. Full-tournament brackets keep it.
  const hasAwards = awards.some((a) => a.value && a.value !== "—");
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className={`${LABEL} mb-3`}>Their picks</p>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-sunk p-3">
          <Flag code={champion.code} size={26} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Champion</p>
            <p className="truncate font-display text-lg text-ink">{champion.name}</p>
          </div>
          <span
            aria-hidden
            className="h-8 w-1.5 shrink-0 rounded-full"
            style={{ background: teamColor(champion.code) }}
          />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Finalists
          </p>
          <div className="grid grid-cols-2 gap-2">
            {finalists.map((f, i) => (
              <TeamLine key={`finalist-${i}`} pick={f} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Group winners
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {groupWinners.map((g) => (
              <div
                key={g.group}
                className="flex items-center gap-1.5 rounded-lg border border-line-soft bg-surface-sunk px-2 py-1.5"
              >
                <span className="w-4 shrink-0 font-mono text-[11px] font-bold text-ink-3">
                  {g.group}
                </span>
                <Flag code={g.code} size={16} />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        {thirdAdvance.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              3rd-place advancers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {thirdAdvance.map((t) => (
                <span
                  key={t.code}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink"
                >
                  <Flag code={t.code} size={14} /> {t.code}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {hasAwards ? (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Awards
            </p>
            <dl className="space-y-1">
              {awards.map((a) => (
                <div key={a.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="shrink-0 text-ink-3">{a.label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-ink">{a.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// One decimal, trailing ".0" dropped — projected points are fractional.
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

// Display-only win-model projection for this entry: where they're heading and how
// much upside is left. Never part of their actual score.
function ProjectionCard({
  projection,
  currentRank,
}: {
  projection: EntryProjectionView;
  currentRank: number;
}) {
  const delta = currentRank - projection.projectedRank; // >0 ⇒ projected to climb
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className={LABEL}>Projected finish</p>
      <div className="mt-2 flex items-end gap-4">
        <div className="leading-none">
          <span className="font-display text-[40px] text-ink">#{projection.projectedRank}</span>
          {delta !== 0 ? (
            <span
              className="ml-1.5 font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: delta > 0 ? "var(--positive)" : "var(--negative)" }}
            >
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta)}
            </span>
          ) : null}
        </div>
        <div className="ml-auto text-right leading-none">
          <span className="font-display text-[32px] tabular-nums text-ink">
            {fmt(projection.projectedTotal)}
          </span>
          <span className="text-xs text-ink-3"> proj pts</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {projection.expectedRemaining > 0
          ? `+${fmt(projection.expectedRemaining)} expected from the knockout rounds, on championship & match odds.`
          : "No expected points left from the knockout rounds."}{" "}
        For fun — it never changes your actual score.
      </p>
    </div>
  );
}

// The reveal banner shown before picks lock — phrased per format, since lock
// timing differs (full bracket at tournament kickoff, knockout at the R32
// kickoff). Defaults to neutral wording.
function revealCopy(format?: string): string {
  if (format === "KNOCKOUT") {
    return "Picks reveal at kickoff — come back once picks lock at the Round of 32 kickoff to see this bracket.";
  }
  if (format === "FULL_BRACKET") {
    return "Picks reveal at kickoff — come back once the tournament locks to see this bracket.";
  }
  return "Come back once picks lock to see this bracket.";
}

export function Profile({ profile, format }: { profile: ProfileData; format?: string }) {
  const { accuracy, boldest } = profile;
  const isLeader = profile.rank === 1;
  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border bg-surface p-5 ${
          isLeader ? "border-gold shadow-[var(--shadow-ring-gold)]" : "border-line shadow-[var(--shadow-xs)]"
        }`}
      >
        <p className={LABEL}>{isLeader ? "Pool leader" : "Participant"}</p>
        <h2 className="mt-1 break-words font-display text-2xl text-ink">{profile.label}</h2>
        <div className="mt-3 flex items-end gap-4">
          <div className="leading-none">
            <span className="font-display text-[40px] text-ink">#{profile.rank}</span>
            <span className="ml-1.5 text-sm text-ink-3">of {profile.entryCount}</span>
          </div>
          <div className="ml-auto text-right leading-none">
            <span className="font-display text-[32px] tabular-nums text-ink">{profile.total}</span>
            <span className="text-xs text-ink-3"> pts</span>
            {profile.projected ? (
              <span className="mt-1 block font-mono text-[11px] tabular-nums text-positive">
                ▲ {profile.projected} live
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className={LABEL}>Knockout accuracy</p>
          <p className="mt-2 font-display text-[28px] tabular-nums text-ink">{accuracy.pct}%</p>
          <p className="text-xs text-ink-3">
            {accuracy.hits}/{accuracy.decided} decided
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className={LABEL}>Boldest call</p>
          {boldest && profile.locked ? (
            <>
              <p className="mt-2 truncate font-semibold text-ink">{boldest.pickName}</p>
              <p className="text-xs text-ink-3">
                {boldest.roundLabel} · only {boldest.sharePct}% nailed it
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-3">No correct knockout calls yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className={LABEL}>Points by category</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.categories.map((c) => (
            <span
              key={c.key}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                c.points > 0 ? "bg-pitch-tint text-pitch-dark" : "bg-surface-sunk text-ink-4"
              }`}
            >
              {c.label} {c.points}
            </span>
          ))}
        </div>
      </div>

      {profile.locked ? (
        <>
          {profile.projection ? (
            <ProjectionCard projection={profile.projection} currentRank={profile.rank} />
          ) : null}
          <Selections selections={profile.selections} />
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className={`${LABEL} mb-3`}>Knockout hit grid</p>
            <HitGrid hits={profile.hitGrid} />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink-3">{revealCopy(format)}</p>
        </div>
      )}
    </div>
  );
}
