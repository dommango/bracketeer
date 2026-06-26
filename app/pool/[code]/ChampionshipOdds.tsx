import { OddsBoard } from "./OddsBoard";
import type { ChampionshipOdd } from "@/lib/pool/queries";

// Tournament-winner futures, highest implied probability first. A thin wrapper
// over the shared OddsBoard so the title market and every other odds surface
// share one visual pattern; each row links to the team drill-down.
export function ChampionshipOdds({
  odds,
  code,
  basePath,
}: {
  odds: ChampionshipOdd[];
  code?: string;
  basePath?: string;
}) {
  const base = basePath ?? `/pool/${code}`;
  return (
    <OddsBoard
      title="Title odds"
      subtitle="Market-implied chance of winning the tournament."
      fetchedAt={odds[0]?.fetchedAt}
      rows={odds.map((o) => ({
        key: o.teamCode,
        code: o.teamCode,
        primary: o.name,
        secondary: o.teamCode,
        winProb: o.winProb,
        href: `${base}/teams/${o.teamCode}`,
      }))}
    />
  );
}
