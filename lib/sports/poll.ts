// Score poller: pulls finished fixtures and applies knockout winners to the
// answer key, never overwriting a manual entry. Group results are not applied
// here — group scoring is driven by standings (1st/2nd/thirds), which an admin
// sets directly. Safe no-op when SPORTS_API_KEY or the fixture maps are empty.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { isScoredKnockout } from "@/lib/pool/rounds";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { buildKnockoutPairMatchNos } from "@/lib/pool/bracket";
import { asResults } from "@/lib/pool/scoring";
import {
  fetchFixtures,
  fetchMatchEvents,
  fetchMatchStats,
  fetchFixturePlayers,
  type FinishedFixture,
  type RawMatchEvent,
} from "./client";
import { parseFixturePlayers } from "./fixture-players-parse";
import { EXTERNAL_TO_MATCHNO, EXTERNAL_TEAM_CODES } from "./fixtures-map";
import {
  setKnockoutResultFromApi,
  upsertGroupMatchResultFromApi,
  upsertKnockoutDisplayFromApi,
  backfillGroupMatchScheduledAt,
  promoteCompletedGroupsToOfficial,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { resolveWinnerExternalId } from "./winner";
import { buildGroupPairMatchNos, TEAMS } from "@/lib/scoring/data";
import { knockoutResultPush } from "@/lib/push/messages";
import type { ApnsPayload } from "@/lib/push/apns";
import { postSystemMessage } from "@/lib/pool/chat";
import { postChallengeSystemMessage } from "@/lib/challenge/chat";
import { notifyPool } from "@/lib/realtime/notify";
import {
  formatGoalLine,
  formatCardLine,
  formatFinalLine,
  type AnnouncedEvent,
} from "@/lib/pool/chat-events";
import type { EventType } from "@/generated/prisma/client";

// How close a fixture's kickoff must be to a knockout match's scheduled time for the
// team-pair fallback to map it there. Knockout games are days apart, so ±12h uniquely
// identifies one — and a finished group fixture (weeks earlier) with the same pair as
// a final can't fall inside it.
const KO_FIXTURE_PROXIMITY_MS = 12 * 60 * 60 * 1000;

// Post one auto-event line to every pool of the tournament AND the shared global
// challenge chat (one thread per tournament), pinging each pool's chat stream.
// Best-effort decoration — callers wrap it so a failure never breaks the poll, and
// each target is isolated so one failure can't drop the rest. Exported nowhere;
// lives here beside its only callers.
async function announceMatchEvent(
  tournamentId: string,
  body: string,
  meta: Record<string, unknown>,
): Promise<void> {
  const pools = await prisma.pool.findMany({ where: { tournamentId }, select: { id: true } });
  for (const p of pools) {
    try {
      await postSystemMessage(p.id, body, meta);
      await notifyPool(p.id, "chat");
    } catch (err) {
      console.error(`announce failed for pool ${p.id}:`, err);
    }
  }
  // The public challenge has no backing pool, so post into its tournament-scoped
  // chat separately. Match updates show up as "Match update" SYSTEM rows there,
  // matching the live-match feed pool members get.
  try {
    await postChallengeSystemMessage(tournamentId, body, meta);
  } catch (err) {
    console.error("challenge announce failed:", err);
  }
}

export interface PollSummary {
  skipped?: boolean;
  reason?: string;
  fetched?: number;
  applied?: number;
  koLiveApplied?: number;
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

// Stable identity for an event within a match — used both to dedupe storage and
// to diff this poll's feed against what we already stored (for chat announcements).
function eventKey(r: { minute: number; extraMinute: number | null; type: EventType; teamCode: string }): string {
  return `${r.minute}|${r.extraMinute ?? ""}|${r.type}|${r.teamCode}`;
}

// Replaces all events for a match atomically (delete-then-insert) and returns the
// events that are new this poll (not previously stored) so the caller can announce them.
async function persistEvents(
  matchId: string,
  rawEvents: RawMatchEvent[],
  teamCodeByExternalId: Record<string, string>,
): Promise<{ written: number; added: AnnouncedEvent[] }> {
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

  const existing = await prisma.matchEvent.findMany({
    where: { matchId },
    select: { minute: true, extraMinute: true, type: true, teamCode: true },
  });
  const seen = new Set(existing.map(eventKey));
  const added: AnnouncedEvent[] = rows
    .filter((r) => !seen.has(eventKey(r)))
    .map((r) => ({
      type: r.type,
      teamCode: r.teamCode,
      playerName: r.playerName,
      minute: r.minute,
      extraMinute: r.extraMinute,
    }));

  await prisma.$transaction([
    prisma.matchEvent.deleteMany({ where: { matchId } }),
    ...(rows.length > 0 ? [prisma.matchEvent.createMany({ data: rows, skipDuplicates: true })] : []),
  ]);

  return { written: rows.length, added };
}

export async function pollScores(): Promise<PollSummary> {
  if (!sportsApiEnabled) return { skipped: true, reason: "SPORTS_API_KEY not configured" };

  const tournamentId = await getTournamentIdBySlug();

  if (!await shouldPollNow(tournamentId)) {
    return { skipped: true, reason: "no match in live window" };
  }

  const fixtures = await fetchFixtures();

  // The knockout answer key, used to map a fixture to our match by the two teams
  // playing (and to orient the live scoreline). This is the fallback the static
  // fixture-id map never had — so live/finished knockout matches map correctly even
  // when EXTERNAL_TO_MATCHNO is empty (it ships empty until generated post-groups).
  const [tournament, knockoutMatches] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { officialResults: true },
    }),
    prisma.match.findMany({
      where: { tournamentId, matchNo: { gte: 73 } },
      select: { matchNo: true, scheduledAt: true },
    }),
  ]);
  const knockoutPairMatchNos = buildKnockoutPairMatchNos(asResults(tournament?.officialResults));
  // Each knockout match's kickoff, to disambiguate the team-pair fallback by date
  // (see KO_FIXTURE_PROXIMITY_MS) — a fixture maps to a knockout slot only when it
  // kicks off near that match's scheduled time.
  const knockoutScheduleByNo = new Map<number, Date>();
  for (const m of knockoutMatches) {
    if (m.scheduledAt) knockoutScheduleByNo.set(m.matchNo, m.scheduledAt);
  }

  // Fixtures to enrich in Pass 3 (events + statistics): matchId + provider team ids
  // for correct home/away stat assignment (API order isn't guaranteed), plus the
  // codes/score needed to format goal & card chat posts.
  type EnrichTarget = {
    fixtureId: number;
    matchId: string;
    matchNo: number;
    homeTeamId: number;
    awayTeamId: number;
    homeCode: string;
    awayCode: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  // Currently-live fixtures get the full treatment (new events announced to chat).
  const liveFixtures: EnrichTarget[] = [];
  // Fixtures that flipped to FINAL this poll — enriched once so every match ends with
  // a complete event timeline + final stat line, even if it finished between ticks or
  // its closing minutes were never seen live. No chat announce (avoids replaying a
  // whole match's events at once).
  const finishedFixtures: EnrichTarget[] = [];

  // --- Pass 1: knockout results (finished → answer key) + live display rows ---
  let applied = 0;
  let koLiveApplied = 0;
  const appliedKnockouts: { matchNo: number; winnerCode: string }[] = [];
  for (const f of fixtures) {
    const homeCode = EXTERNAL_TEAM_CODES[f.homeExternalId];
    const awayCode = EXTERNAL_TEAM_CODES[f.awayExternalId];
    // Map to our match: prefer the static fixture-id map, else the two seated teams —
    // but accept the pair fallback only when the fixture kicks off near that knockout
    // match's scheduled time (guards against a group rematch of a final's pairing).
    let matchNo = EXTERNAL_TO_MATCHNO[f.externalId] as number | undefined;
    if (matchNo == null && homeCode && awayCode) {
      const cand = knockoutPairMatchNos.get([homeCode, awayCode].sort().join("_"));
      const sched = cand != null ? knockoutScheduleByNo.get(cand) : undefined;
      if (
        cand != null &&
        sched &&
        f.scheduledAt != null &&
        Math.abs(new Date(f.scheduledAt).getTime() - sched.getTime()) <= KO_FIXTURE_PROXIMITY_MS
      ) {
        matchNo = cand;
      }
    }
    if (matchNo == null || matchNo < 73 || matchNo > 104) continue;

    if (f.finished) {
      // Finished → record the winner in the answer key. Scored knockouts only (bronze
      // isn't scored). This is the only knockout write that touches scoring.
      if (!isScoredKnockout(matchNo)) continue;
      const winnerCode = resolveWinnerCode(f);
      if (!winnerCode) continue;
      const { applied: didApply } = await setKnockoutResultFromApi(tournamentId, matchNo, {
        winnerCode,
        homeScore: f.homeGoals,
        awayScore: f.awayGoals,
        homePens: f.homePens,
        awayPens: f.awayPens,
        // API orientation of the scores above — the mirror re-orients them to the
        // bracket slot so the FINAL row can't flip against the live row.
        apiHomeCode: homeCode ?? null,
        apiAwayCode: awayCode ?? null,
        final: true,
      });
      if (didApply) {
        applied += 1;
        appliedKnockouts.push({ matchNo, winnerCode });
        // One-shot backfill target: guarantee a complete event list + final stat line
        // for the knockout, even if its closing minutes were never polled live.
        const m = await prisma.match.findUnique({
          where: { tournamentId_matchNo: { tournamentId, matchNo } },
          select: { id: true },
        });
        if (m) {
          finishedFixtures.push({
            fixtureId: f.fixtureId,
            matchId: m.id,
            matchNo,
            homeTeamId: Number(f.homeExternalId),
            awayTeamId: Number(f.awayExternalId),
            homeCode: homeCode ?? "",
            awayCode: awayCode ?? "",
            homeScore: f.homeGoals,
            awayScore: f.awayGoals,
          });
        }
      }
    } else if (f.live && homeCode && awayCode && isScoredKnockout(matchNo)) {
      // In-play → display-only LIVE row so the match surfaces as live on the home /
      // challenge tabs (no answer-key or scoring change until full time). Scored
      // knockouts only, so bronze (never finalized via the API) can't get stuck LIVE.
      const { applied: didApply, matchId } = await upsertKnockoutDisplayFromApi(
        tournamentId,
        matchNo,
        {
          apiHomeCode: homeCode,
          apiAwayCode: awayCode,
          apiHomeScore: f.homeGoals,
          apiAwayScore: f.awayGoals,
          elapsed: f.elapsed,
        },
      );
      if (didApply) {
        koLiveApplied += 1;
        if (matchId) {
          liveFixtures.push({
            fixtureId: f.fixtureId,
            matchId,
            matchNo,
            homeTeamId: Number(f.homeExternalId),
            awayTeamId: Number(f.awayExternalId),
            homeCode,
            awayCode,
            homeScore: f.homeGoals,
            awayScore: f.awayGoals,
          });
        }
      }
    }
  }

  // --- Pass 2: group match display scores + scheduledAt backfill ---
  const groupPairMatchNos = buildGroupPairMatchNos();
  const scheduledAtQueue: Array<{ matchNo: number; scheduledAt: Date }> = [];
  // Group matches that flipped to FINAL this poll — for the one-time FT chat post.
  const finals: Array<{ matchNo: number; homeCode: string; awayCode: string; homeScore: number; awayScore: number }> = [];
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
      const { applied: didApply, matchId, newlyFinal } = await upsertGroupMatchResultFromApi(
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
      if (newlyFinal) {
        finals.push({ matchNo, homeCode, awayCode, homeScore: f.homeGoals ?? 0, awayScore: f.awayGoals ?? 0 });
        if (matchId) {
          finishedFixtures.push({
            fixtureId: f.fixtureId,
            matchId,
            matchNo,
            homeTeamId: Number(f.homeExternalId),
            awayTeamId: Number(f.awayExternalId),
            homeCode,
            awayCode,
            homeScore: f.homeGoals,
            awayScore: f.awayGoals,
          });
        }
      }
      if (f.live && matchId) {
        liveFixtures.push({
          fixtureId: f.fixtureId,
          matchId,
          matchNo,
          homeTeamId: Number(f.homeExternalId),
          awayTeamId: Number(f.awayExternalId),
          homeCode,
          awayCode,
          homeScore: f.homeGoals,
          awayScore: f.awayGoals,
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
  // Push only for newly-applied knockout results (the high-signal event). One
  // applied match gets the specific round/winner copy; a multi-match poll run
  // (rare — they kick off hours apart) gets an aggregate nudge.
  let push: ApnsPayload | undefined;
  if (appliedKnockouts.length === 1) {
    const k = appliedKnockouts[0];
    push = knockoutResultPush(k.matchNo, TEAMS[k.winnerCode] ?? k.winnerCode);
  } else if (appliedKnockouts.length > 1) {
    push = { title: "⚽ Knockout results are in", body: "Standings just moved — check the leaderboard." };
  }
  // A live knockout display update changes no score, but still recompute+notify so
  // the home/challenge "live now" surfaces refresh over SSE (mirrors the group path).
  if (applied > 0 || groupsApplied > 0 || koLiveApplied > 0) {
    await recomputeTournamentPools(tournamentId, push);
  }

  // Full-time chat posts for group matches that just settled (best-effort).
  for (const fin of finals) {
    try {
      await announceMatchEvent(
        tournamentId,
        formatFinalLine(fin.homeCode, fin.awayCode, fin.homeScore, fin.awayScore),
        { matchNo: fin.matchNo, kind: "final" },
      );
    } catch (err) {
      console.error("FT announce failed:", err);
    }
  }

  // --- Pass 3: events + stats for live fixtures (announced) and just-finished
  // fixtures (one-shot backfill, no announce) ---
  let eventsWritten = 0;
  let statsWritten = 0;

  // Fetch + persist events and statistics for one fixture. `announce` posts newly-seen
  // goals/cards to chat (live only); a FINAL backfill stays silent so it doesn't replay
  // the whole match's events at once.
  const enrich = async (lf: EnrichTarget, announce: boolean): Promise<{ events: number; stats: number }> => {
    const { fixtureId, matchId, homeTeamId, awayTeamId } = lf;
    // Player stats are best-effort decoration: a failure there must not drop the
    // event timeline / stat line, so it resolves to null instead of rejecting.
    const [rawEvents, rawStats, rawPlayers] = await Promise.all([
      fetchMatchEvents(fixtureId),
      fetchMatchStats(fixtureId, homeTeamId, awayTeamId),
      fetchFixturePlayers(fixtureId).catch((err) => {
        console.error(`player stats fetch failed for fixture ${fixtureId}:`, err);
        return null;
      }),
    ]);

    const { written, added } = await persistEvents(matchId, rawEvents, EXTERNAL_TEAM_CODES);

    if (announce) {
      for (const e of added) {
        const line =
          formatGoalLine(e, lf.homeCode, lf.awayCode, lf.homeScore ?? 0, lf.awayScore ?? 0) ??
          formatCardLine(e);
        if (!line) continue;
        try {
          await announceMatchEvent(tournamentId, line, { matchNo: lf.matchNo, kind: "event" });
        } catch (err) {
          console.error("event announce failed:", err);
        }
      }
    }

    let statsCount = 0;
    if (rawStats) {
      await prisma.matchStats.upsert({
        where: { matchId },
        update: { home: rawStats.home as object, away: rawStats.away as object },
        create: { matchId, home: rawStats.home as object, away: rawStats.away as object },
      });
      statsCount = 1;
    }

    // Per-player ratings/stats (assigned home/away by provider id). Best-effort.
    if (rawPlayers) {
      try {
        const sides = parseFixturePlayers(rawPlayers, homeTeamId, awayTeamId);
        if (sides) {
          const data = {
            home: sides.home as object,
            away: sides.away as object,
            raw: rawPlayers as object,
            fetchedAt: new Date(),
          };
          await prisma.matchPlayerStats.upsert({
            where: { matchId },
            update: data,
            create: { matchId, ...data },
          });
        }
      } catch (err) {
        console.error(`player stats persist failed for match ${matchId}:`, err);
      }
    }

    return { events: written, stats: statsCount };
  };

  const targets: Array<{ lf: EnrichTarget; announce: boolean }> = [
    ...liveFixtures.map((lf) => ({ lf, announce: true })),
    ...finishedFixtures.map((lf) => ({ lf, announce: false })),
  ];

  if (targets.length > 0) {
    const enrichResults = await Promise.allSettled(targets.map((t) => enrich(t.lf, t.announce)));
    for (const r of enrichResults) {
      if (r.status === "fulfilled") {
        eventsWritten += r.value.events;
        statsWritten += r.value.stats;
      } else {
        console.error("Pass 3 enrichment failed:", r.reason);
      }
    }
  }

  return { fetched: fixtures.length, applied, koLiveApplied, groupsApplied, eventsWritten, statsWritten };
}
