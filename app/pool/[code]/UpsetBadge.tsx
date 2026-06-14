import { liveUpset, type ImpliedProbs } from "@/lib/odds/map";

export function UpsetBadge({
  status,
  homeScore,
  awayScore,
  odds,
}: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  odds: ImpliedProbs | null;
}) {
  if (!odds || status !== "LIVE") return null;
  if (!liveUpset({ status, homeScore, awayScore }, odds)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white"
      style={{ background: "var(--gold-dark)" }}
    >
      ⚡ Upset
    </span>
  );
}
