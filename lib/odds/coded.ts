// Shared by both odds pollers: builds the list of fixtures with their resolved
// 3-letter team codes (group teams from slots/results, knockout teams from the
// resolved bracket), so provider events can be matched to an internal matchNo.

import { prisma } from "@/lib/db";
import { resolveBracket } from "@/lib/pool/bracket";
import { asResults } from "@/lib/pool/scoring";
import type { CodedMatch } from "@/lib/odds/map";

export interface CodedMatchWithId extends CodedMatch {
  matchId: string;
}

export async function loadCodedMatches(
  tournamentId: string,
  officialResults: unknown,
): Promise<CodedMatchWithId[]> {
  const resolved = resolveBracket(asResults(officialResults));

  const rows = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      matchNo: true,
      roundCode: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: { select: { homeTeamCode: true, awayTeamCode: true } },
    },
  });

  return rows.map((m) => {
    const isGroup = m.roundCode === "GROUP";
    const r = resolved[m.matchNo];
    const homeCode = isGroup
      ? (m.result?.homeTeamCode ?? m.homeSlotRef)
      : (m.result?.homeTeamCode ?? r?.home ?? null);
    const awayCode = isGroup
      ? (m.result?.awayTeamCode ?? m.awaySlotRef)
      : (m.result?.awayTeamCode ?? r?.away ?? null);
    return { matchNo: m.matchNo, matchId: m.id, homeCode, awayCode };
  });
}
