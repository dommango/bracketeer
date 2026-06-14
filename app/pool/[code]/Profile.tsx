import type { Profile as ProfileData, KnockoutHit } from "@/lib/pool/profile";
import { ROUND_ORDER, roundLabel } from "@/lib/pool/rounds";

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

export function Profile({ profile }: { profile: ProfileData }) {
  const { accuracy, boldest } = profile;
  const isLeader = profile.rank === 1;
  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border bg-surface p-5 ${
          isLeader ? "border-gold shadow-[var(--shadow-ring-gold)]" : "border-line shadow-[var(--shadow-xs)]"
        }`}
      >
        <p className={LABEL}>{isLeader ? "Pool leader" : "Player"}</p>
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
          {boldest ? (
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

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className={`${LABEL} mb-3`}>Knockout hit grid</p>
        <HitGrid hits={profile.hitGrid} />
      </div>
    </div>
  );
}
