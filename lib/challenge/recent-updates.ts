// One tournament-wide scoreboard feed shared by both challenge home boards, so the
// "what's live now" list (and the live/last/next score cards built from the same
// scope) is identical whether you're viewing Match Day Pickem or the Knockout
// Challenge. Toggling between them no longer changes which matches are shown.

import { prisma } from "@/lib/db";
import { buildMatchUpdateLines, type MatchUpdate } from "@/lib/challenge/match-updates";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";

// The matches both public challenges care about: the Match Day Pickem fixtures
// (the final group round) plus every knockout match (73–104). Both have detail
// pages, so each card on the shared board links somewhere real.
const KNOCKOUT_NOS = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i);
export const BOARD_MATCH_NOS: readonly number[] = [...MD3_MATCH_NOS, ...KNOCKOUT_NOS];

// Recent goal / red-card / full-time lines across the shared board, newest first.
// Rebuilt from MatchEvent + Result via the pure buildMatchUpdateLines.
export async function getRecentTournamentUpdates(
  tournamentId: string,
  limit = 6,
): Promise<MatchUpdate[]> {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      matchNo: { in: [...BOARD_MATCH_NOS] },
      result: { status: { in: ["LIVE", "FINAL"] } },
    },
    select: {
      matchNo: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: {
        select: {
          status: true,
          homeScore: true,
          awayScore: true,
          homeTeamCode: true,
          awayTeamCode: true,
          elapsed: true,
          updatedAt: true,
        },
      },
      events: {
        select: { type: true, teamCode: true, playerName: true, minute: true, extraMinute: true },
      },
    },
  });

  // Most-recently-updated match first; within a match, newest line first (so FT
  // and the latest goal lead).
  const ranked = matches
    .filter((m) => m.result)
    .sort((a, b) => b.result!.updatedAt.getTime() - a.result!.updatedAt.getTime());

  const out: MatchUpdate[] = [];
  for (const m of ranked) {
    const r = m.result!;
    const homeCode = r.homeTeamCode ?? m.homeSlotRef ?? "TBD";
    const awayCode = r.awayTeamCode ?? m.awaySlotRef ?? "TBD";
    const lines = buildMatchUpdateLines(homeCode, awayCode, r, m.events);
    for (let i = lines.length - 1; i >= 0; i--) {
      out.push({ key: `${m.matchNo}:${i}`, ...lines[i] });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
