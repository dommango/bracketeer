import type { MatchDetail } from "@/lib/pool/queries";
import type { PickSplit, PickSplitSlice } from "@/lib/pool/pick-split";
import { buildConsensus } from "@/lib/pool/consensus";

// The winner-pick split + model-vs-audience consensus for a scored knockout match.
// Shared by the pool match page (audience "pool") and the public challenge match
// detail (audience "field"), so both render the identical card from the same data.

const SLICE_COLOR: Record<string, string> = {
  home: "var(--pitch)",
  away: "var(--round-r16)",
  other: "var(--ink-4)",
};

function SplitRow({ slice, kind }: { slice: PickSplitSlice; kind: keyof typeof SLICE_COLOR }) {
  if (slice.count === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{slice.name}</span>
        <span className="font-mono tabular-nums text-ink-3">
          {slice.count} · {slice.pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunk">
        <div
          className="h-full rounded-full"
          style={{ width: `${slice.pct}%`, background: SLICE_COLOR[kind] }}
        />
      </div>
    </div>
  );
}

export function PickSplitCard({ split, audience = "pool" }: { split: PickSplit; audience?: string }) {
  const cap = audience.charAt(0).toUpperCase() + audience.slice(1);
  if (split.total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{cap} pick-split</p>
        <p className="mt-2 text-sm text-ink-3">No winner picks recorded for this match yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        {cap} pick-split · {split.total} {split.total === 1 ? "entry" : "entries"}
      </p>
      <div className="mt-3 space-y-3">
        <SplitRow slice={split.home} kind="home" />
        <SplitRow slice={split.away} kind="away" />
        <SplitRow slice={split.other} kind="other" />
      </div>
    </div>
  );
}

function ConsensusBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs font-medium text-ink-3">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunk">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-ink-3">{pct}%</span>
    </div>
  );
}

// Model-vs-audience consensus: overlays the API-Football model's win % against the
// audience's own pick-split for this knockout match. Renders nothing when the model
// has no win percentages or nobody has picked the match.
export function ConsensusCard({
  prediction,
  pickSplit,
  home,
  away,
  audience = "pool",
}: {
  prediction: MatchDetail["prediction"];
  pickSplit: PickSplit;
  home: MatchDetail["home"];
  away: MatchDetail["away"];
  audience?: string;
}) {
  if (!prediction || pickSplit.total === 0) return null;
  const consensus = buildConsensus({
    homeCode: home.code,
    awayCode: away.code,
    homeName: home.name,
    awayName: away.name,
    modelHomePct: prediction.homePercent,
    modelAwayPct: prediction.awayPercent,
    poolHomePct: pickSplit.home.pct,
    poolAwayPct: pickSplit.away.pct,
    poolOtherPct: pickSplit.other.pct,
  });
  if (!consensus) return null;

  const cap = audience.charAt(0).toUpperCase() + audience.slice(1);
  const { modelFavorite, poolFavorite, agree, poolDivided } = consensus;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Model vs {audience}</p>
      <p className="mt-2 text-sm text-ink-2">
        {poolDivided ? (
          <>
            Model favors <span className="font-semibold text-ink">{modelFavorite.name}</span>{" "}
            {modelFavorite.modelPct}% — but the biggest share of the {audience} (
            {consensus.poolOtherPct}%) bracketed a different team into this match.
          </>
        ) : agree ? (
          <>
            Model favors <span className="font-semibold text-ink">{modelFavorite.name}</span>{" "}
            {modelFavorite.modelPct}% — the {audience} backed them{" "}
            <span className="font-semibold text-ink">{modelFavorite.poolPct}%</span>.
          </>
        ) : (
          <>
            Model favors <span className="font-semibold text-ink">{modelFavorite.name}</span>{" "}
            {modelFavorite.modelPct}%, but the {audience} leaned{" "}
            <span className="font-semibold text-ink">{poolFavorite.name}</span> ({poolFavorite.poolPct}%).
          </>
        )}
      </p>
      <div className="mt-3 space-y-2">
        <ConsensusBar label="Model" pct={modelFavorite.modelPct} color="var(--round-r16)" />
        <ConsensusBar label={cap} pct={modelFavorite.poolPct} color="var(--pitch)" />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-4">
        Both rows show {modelFavorite.code}
      </p>
    </div>
  );
}
