// Tournament-scoped venue rows for the public-challenge stadium pages: the games
// at one host city, as live Match-Center rows (the same scorecards used across
// the app), in one chronological list. No pool context — picks aren't overlaid.

import { buildMatchCenter, type MatchCenterSection } from "@/lib/pool/match-center";
import { getTournamentMatchInputs } from "@/lib/pool/queries";
import { sortChrono } from "@/lib/pool/fixture-views";

export async function getChallengeVenueSections(
  tournamentId: string,
  cityToken: string,
): Promise<MatchCenterSection[]> {
  const inputs = await getTournamentMatchInputs(tournamentId);
  const rows = buildMatchCenter(inputs, {})
    .flatMap((s) => s.matches)
    .filter((m) => m.cityToken === cityToken);
  if (rows.length === 0) return [];
  return [{ roundCode: "GROUP", label: "", matches: sortChrono(rows) }];
}
