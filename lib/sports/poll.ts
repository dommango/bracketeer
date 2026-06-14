// Score poller: pulls finished fixtures and applies knockout winners to the
// answer key, never overwriting a manual entry. Group results are not applied
// here — group scoring is driven by standings (1st/2nd/thirds), which an admin
// sets directly. Safe no-op when SPORTS_API_KEY or the fixture maps are empty.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { isScoredKnockout } from "@/lib/pool/rounds";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import {
  fetchFixtures,
  fetchMatchEvents,
  fetchMatchStats,
  type FinishedFixture,
  type RawMatchEvent,
} from "./client";
import { EXTERNAL_TO_MATCHNO, EXTERNAL_TEAM_CODES } from "./fixtures-map";
import {
  setKnockoutResultFromApi,
  upsertGroupMatchResultFromApi,
  backfillGroupMatchScheduledAt,
  promoteCompletedGroupsToOfficial,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { resolveWinnerExternalId } from "./winner";
import { buildGroupPairMatchNos } from "@/lib/scoring/data";
import type { EventType } from "@/generated/prisma/client";

export interface PollSummary {
  skipped?: boolean;
  reason?: string;
  fetched?: number;
  applied?: number;
  groupsApplied?: number;
  eventsWritten?: number;
  statsWritten?: number;
}

// Returns true when at least one match has a scheduledAt within
// [now − 155min, now + 5min]. Equivalent to: now is inside a match's live window
// [scheduledAt − 5min, scheduledAt + 155min]. 155 min covers 90 min regulation +
// 30 min extra time + ~35 min shootout / breaks / stoppage buffer.
async function shouldPollNow(tournamentId: string): Promise<boolean> {
  const now = Date.now();
  const inWindow = await prisma.match.findFirst({
    where: {
      tournamentId,
      scheduledAt: {
        gt: new Date(now - 155 * 60 * 1000),
        lt: new Date(now + 5 * 60 * 1000),
      },
    },
    select: { id: true },
  });
  if (inWindow) return true;

  // Bootstrap: group matches are seeded with no kickoff time (scheduledAt null),
  // and the only thing that backfills them is a poll run — a deadlock that would
  // keep the live window permanently closed through the whole group stage. So
  // while any unscored match still has an unknown kickoff, poll regardless: the
  // fetched fixtures backfill scheduledAt (backfillGroupMatchScheduledAt below),
  // after which this falls back to the precise window check above.
  const unscheduled = await prisma.match.findFirst({
    where: { tournamentId, scheduledAt: null, scored: false },
    select: { id: true },
  });
  return unscheduled != null;
}

function resolveWinnerCode(f: FinishedFixture): string | null {
  const winnerExternalId = resolveWinnerExternalId(f);
  if (winnerExternalId == null) return null;
  return EXTERNAL_TEAM_CODES[winnerExternalId] ?? null;
}

// Maps an API-Football event type + detail to our EventType enum.
// Returns null for event types we don't model (VAR reviews, etc.).
function toEventType(type: string, detail: string): EventType | null {
  const t = type.toLowerCase();
  const d = detail.toLowerCase();

  if (t === "goal") {
    if (d.includes("own goal")) return "OWN_GOAL";
    if (d.includes("missed penalty")) return "PENALTY_MISSED";
    if (d.includes("penalty")) return "PENALTY_GOAL";
    return "GOAL";
  }
  if (t === "card") {
    if (d.includes("yellow red") || d.includes("second yellow")) return "YELLOW_RED_CARD";
    if (d.includes("red")) return "RED_CARD";
    if (d.includes("yellow")) return "YELLOW_CARD";
  }
  if (t === "subst") return "SUBSTITUTION";

  return null;
}

// Replaces all events for a match atomically (delete-then-insert).
async function persistEvents(
  matchId: string,
  rawEvents: RawMatchEvent[],
  teamCodeByExternalId: Record<string, string>,
): Promise<number> {
  const rows = rawEvents.flatMap((e) => {
    const type = toEventType(e.type, e.detail);
    if (!type) return [];
    const teamCode = teamCodeByExternalId[String(e.team.id)];
    if (!teamCode) return [];
    return [{
      matchId,
      minute: e.time.elapsed,
      extraMinute: e.time.extra ?? null,
      type,
      teamCode,
      playerName: e.player.name ?? null,
      assistName: e.assist.name ?? null,
    }];
  });

  await prisma.$transaction([
    prisma.matchEvent.deleteMany({ where: { matchId } }),
    ...(rows.length > 0 ? [prisma.matchEvent.createMany({ data: rows, skipDuplicates: true })] : []),
  ]);

  return rows.length;
}

export async function pollScores(): Promise<PollSummary> {
  if (!sportsApiEnabled) return { skipped: true, reason: "SPORTS_API_KEY not configured" };

  const tournamentId = await getTournamentIdBySlug();

  if (!await shouldPollNow(tournamentId)) {
    return { skipped: true, reason: "no match in live window" };
  }

  const fixtures = await fetchFixtures();

  // --- Pass 1: knockout results via fixture-id map ---
  let applied = 0;
  for (const f of fixtures) {
    const matchNo = EXTERNAL_TO_MATCHNO[f.externalId];
    if (!matchNo || !isScoredKnockout(matchNo)) continue;
    if (!f.finished) continue;

    const winnerCode = resolveWinnerCode(f);
    if (!winnerCode) continue;

    const { applied: didApply } = await setKnockoutResultFromApi(tournamentId, matchNo, {
      winnerCode,
      homeScore: f.homeGoals,
      awayScore: f.awayGoals,
      final: true,
    });
    if (didApply) applied += 1;
  }

  // --- Pass 2: group match display scores + scheduledAt backfill ---
  // Collect live fixtures as we go for Pass 3 enrichment.
  const groupPairMatchNos = buildGroupPairMatchNos();
  const scheduledAtQueue: Array<{ matchNo: number; scheduledAt: Date }> = [];
  // Live group fixtures to enrich in Pass 3: matchId + provider team ids for
  // correct home/away stat assignment (API response order is not guaranteed).
  const liveFixtures: Array<{ fixtureId: number; matchId: string; homeTeamId: number; awayTeamId: number }> = [];
  let groupsApplied = 0;

  for (const f of fixtures) {
    const homeCode = EXTERNAL_TEAM_CODES[f.homeExternalId];
    const awayCode = EXTERNAL_TEAM_CODES[f.awayExternalId];
    if (!homeCode || !awayCode) continue;

    const pairKey = [homeCode, awayCode].sort().join("_");
    const matchNo = groupPairMatchNos.get(pairKey);
    if (!matchNo) continue;

    if (f.scheduledAt) scheduledAtQueue.push({ matchNo, scheduledAt: new Date(f.scheduledAt) });

    if (f.live || f.finished) {
      const { applied: didApply, matchId } = await upsertGroupMatchResultFromApi(
        tournamentId,
        matchNo,
        {
          homeCode,
          awayCode,
          homeScore: f.homeGoals,
          awayScore: f.awayGoals,
          live: f.live,
          finished: f.finished,
          elapsed: f.elapsed,
        },
      );
      if (didApply) groupsApplied += 1;
      if (f.live && matchId) {
        liveFixtures.push({
          fixtureId: f.fixtureId,
          matchId,
          homeTeamId: Number(f.homeExternalId),
          awayTeamId: Number(f.awayExternalId),
        });
      }
    }
  }

  if (scheduledAtQueue.length > 0) {
    await backfillGroupMatchScheduledAt(tournamentId, scheduledAtQueue);
  }

  // A finished group match may complete its group — promote it to the official
  // key before recomputing so pools rescore (and the knockout resolves) against
  // the freshly-settled standings rather than the provisional overlay.
  if (groupsApplied > 0) await promoteCompletedGroupsToOfficial(tournamentId);
  if (applied > 0 || groupsApplied > 0) await recomputeTournamentPools(tournamentId);

  // --- Pass 3: events + stats for currently-live group fixtures ---
  let eventsWritten = 0;
  let statsWritten = 0;

  if (liveFixtures.length > 0) {
    const enrichResults = await Promise.allSettled(
      liveFixtures.map(async ({ fixtureId, matchId, homeTeamId, awayTeamId }) => {
        const [rawEvents, rawStats] = await Promise.all([
          fetchMatchEvents(fixtureId),
          fetchMatchStats(fixtureId, homeTeamId, awayTeamId),
        ]);

        const written = await persistEvents(matchId, rawEvents, EXTERNAL_TEAM_CODES);
        let statsCount = 0;
        if (rawStats) {
          await prisma.matchStats.upsert({
            where: { matchId },
            update: { home: rawStats.home as object, away: rawStats.away as object },
            create: { matchId, home: rawStats.home as object, away: rawStats.away as object },
          });
          statsCount = 1;
        }
        return { events: written, stats: statsCount };
      }),
    );

    for (const r of enrichResults) {
      if (r.status === "fulfilled") {
        eventsWritten += r.value.events;
        statsWritten += r.value.stats;
      } else {
        console.error("Pass 3 enrichment failed:", r.reason);
      }
    }
  }

  return { fetched: fixtures.length, applied, groupsApplied, eventsWritten, statsWritten };
}
