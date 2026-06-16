import { OddsBoard } from "./OddsBoard";
import type { ChampionshipOdd } from "@/lib/pool/queries";

// Tournament-winner futures, highest implied probability first. A thin wrapper
// over the shared OddsBoard so the title market and every other odds surface
// share one visual pattern; each row links to the team drill-down.
export function ChampionshipOdds({ odds, code }: { odds: ChampionshipOdd[]; code: string }) {
  return (
    <OddsBoard
      title="Title odds"
      subtitle="Market-implied chance of winning the tournament."
      rows={odds.map((o) => ({
        key: o.teamCode,
        code: o.teamCode,
        primary: o.name,
        secondary: o.teamCode,
        winProb: o.winProb,
        href: `/pool/${code}/teams/${o.teamCode}`,
      }))}
    />
  );
}
