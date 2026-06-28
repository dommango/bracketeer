// Admin answer-key service. The tournament's officialResults is the single
// scoring source of truth (mirroring the original tool's RESULTS object); these
// functions patch it immutably, mirror knockout outcomes into Match/Result rows
// for display, and never recompute on their own — the caller decides when to run
// recomputeTournamentPools so a batch of edits triggers one recompute.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { asResults, recomputePool, recomputeStandalone } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { sendPushToPool } from "@/lib/push/send";
import type { ApnsPayload } from "@/lib/push/apns";
import { resolveBracket, validateKnockoutWinner } from "@/lib/pool/bracket";
import { findStandingsConflict } from "@/lib/pool/standings";
import { promoteCompletedGroups } from "@/lib/pool/group-promote";
import type { GroupResultRow } from "@/lib/pool/group-table";
import { GROUPS, TEAMS } from "@/lib/scoring/data";
import type { Results, TeamCode, Awards } from "@/lib/scoring/types";

type Db = Prisma.TransactionClient;

// Every answer-key mutation is a read-modify-write of one JSON blob, and the
// admin UI and the cron poller can fire concurrently — so all mutators run
// inside one transaction holding a per-tournament advisory lock. Without it,
// two interleaved patches lose one of the writes (e.g. an API result clobbers
// a simultaneous manual correction).
async function withAnswerKeyLock<T>(
  tournamentId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}))`;
    return fn(tx);
  });
}

async function loadAnswerKey(tournamentId: string, db: Db): Promise<Results> {
  const t = await db.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  return asResults(t.officialResults);
}

async function writeAnswerKey(tournamentId: string, next: Results, db: Db): Promise<void> {
  await db.tournament.update({
    where: { id: tournamentId },
    data: { officialResults: next as unknown as object },
  });
}

export interface KnockoutInput {
  winnerCode: TeamCode;
  homeScore?: number | null;
  awayScore?: number | null;
  homePens?: number | null; // shootout score when the tie went to penalties
  awayPens?: number | null;
  final?: boolean; // default true; false marks the match LIVE rather than FINAL
  source?: "API" | "MANUAL"; // default MANUAL
}

// Record a knockout winner. Validates the winner is actually in the (resolved)
// match before writing, then mirrors the outcome into the Match's Result row.
export async function setKnockoutResult(
  tournamentId: string,
  matchNo: number,
  input: KnockoutInput,
): Promise<Results> {
  return withAnswerKeyLock(tournamentId, (tx) =>
    setKnockoutResultLocked(tx, tournamentId, matchNo, input),
  );
}

async function setKnockoutResultLocked(
  tx: Db,
  tournamentId: string,
  matchNo: number,
  input: KnockoutInput,
): Promise<Results> {
  const current = await loadAnswerKey(tournamentId, tx);
  const winner = (input.winnerCode || "").toUpperCase();

  const check = validateKnockoutWinner(current, matchNo, winner);
  if (!check.ok) throw new Error(check.reason ?? "Invalid knockout winner");

  const next: Results = {
    ...current,
    knockout: { ...current.knockout, [matchNo]: winner },
  };
  await writeAnswerKey(tournamentId, next, tx);

  const slot = resolveBracket(next)[matchNo];
  await mirrorResultRow(tx, tournamentId, matchNo, {
    homeTeamCode: slot?.home ?? null,
    awayTeamCode: slot?.away ?? null,
    homeScore: input.homeScore ?? null,
    awayScore: input.awayScore ?? null,
    homePens: input.homePens ?? null,
    awayPens: input.awayPens ?? null,
    winnerCode: winner,
    final: input.final ?? true,
    source: input.source ?? "MANUAL",
  });

  return next;
}

// API-sourced variant for the score poller. A manual entry is authoritative, so
// if a MANUAL Result already exists for this match we leave it untouched. The
// source check runs inside the same lock as the write — a manual correction
// landing mid-poll can no longer be clobbered between check and write.
export async function setKnockoutResultFromApi(
  tournamentId: string,
  matchNo: number,
  input: Omit<KnockoutInput, "source">,
): Promise<{ applied: boolean }> {
  return withAnswerKeyLock(tournamentId, async (tx) => {
    const match = await tx.match.findUnique({
      where: { tournamentId_matchNo: { tournamentId, matchNo } },
      select: { result: { select: { source: true } } },
    });
    if (match?.result?.source === "MANUAL") return { applied: false };

    await setKnockoutResultLocked(tx, tournamentId, matchNo, { ...input, source: "API" });
    return { applied: true };
  });
}

// Clear a previously-entered knockout winner (e.g. a mistaken entry).
export async function clearKnockoutResult(
  tournamentId: string,
  matchNo: number,
): Promise<Results> {
  return withAnswerKeyLock(tournamentId, async (tx) => {
    const current = await loadAnswerKey(tournamentId, tx);
    const knockout = { ...current.knockout };
    delete knockout[matchNo];
    const next: Results = { ...current, knockout };
    await writeAnswerKey(tournamentId, next, tx);

    const match = await tx.match.findUnique({
      where: { tournamentId_matchNo: { tournamentId, matchNo } },
      select: { id: true },
    });
    if (match) {
      await tx.result.deleteMany({ where: { matchId: match.id } });
      await tx.match.update({ where: { id: match.id }, data: { scored: false } });
    }
    return next;
  });
}

// Upsert the display Result row for a group-stage match. Pure display — does NOT
// touch officialResults. Skips if a MANUAL source row already exists. Returns
// false for matches that haven't started yet (live=false and finished=false).
export async function upsertGroupMatchResultFromApi(
  tournamentId: string,
  matchNo: number,
  input: {
    homeCode: string;
    awayCode: string;
    homeScore: number | null;
    awayScore: number | null;
    live: boolean;
    finished: boolean;
    elapsed?: number | null;
  },
): Promise<{ applied: boolean; matchId: string | null; newlyFinal: boolean }> {
  if (!input.live && !input.finished) return { applied: false, matchId: null, newlyFinal: false };

  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: {
      id: true,
      result: { select: { source: true, status: true, homeScore: true, awayScore: true } },
    },
  });
  if (!match) return { applied: false, matchId: null, newlyFinal: false };
  if (match.result?.source === "MANUAL") return { applied: false, matchId: match.id, newlyFinal: false };

  // Monotonic: once a match is FINAL, never let a later poll regress it. A feed
  // that re-reports a finished match as live (or sends a partial payload) must not
  // flip status back to LIVE or un-score the match.
  if (match.result?.status === "FINAL" && !input.finished) {
    return { applied: false, matchId: match.id, newlyFinal: false };
  }

  // True only on the poll that flips this match to FINAL — drives the one-time
  // full-time chat post (a repeated FINAL on later polls must not re-announce).
  const newlyFinal = input.finished && match.result?.status !== "FINAL";

  const status = input.finished ? ("FINAL" as const) : ("LIVE" as const);

  // Never clobber a stored real score with a null from a partial payload, and
  // derive the winner from these effective (coalesced) scores so a FINAL poll
  // that arrives with null goals can't leave 2–1 with no winner highlighted.
  const homeScore = input.homeScore ?? match.result?.homeScore ?? null;
  const awayScore = input.awayScore ?? match.result?.awayScore ?? null;
  const winnerCode =
    input.finished && homeScore !== null && awayScore !== null && homeScore !== awayScore
      ? homeScore > awayScore
        ? input.homeCode
        : input.awayCode
      : null;

  const row = {
    homeTeamCode: input.homeCode,
    awayTeamCode: input.awayCode,
    homeScore,
    awayScore,
    winnerCode,
    elapsed: input.elapsed ?? null,
    status,
    source: "API" as const,
  };
  await prisma.result.upsert({
    where: { matchId: match.id },
    update: row,
    create: { matchId: match.id, ...row },
  });
  await prisma.match.update({
    where: { id: match.id },
    data: { scored: input.finished },
  });

  return { applied: true, matchId: match.id, newlyFinal };
}

// Upsert the display Result row for an IN-PLAY knockout match. Pure display — does
// NOT touch officialResults (the knockout answer key is only written at full time by
// setKnockoutResultFromApi, so a winner is never recorded mid-match and scoring is
// untouched). Mirrors the group live path: skips a MANUAL row, never regresses a
// FINAL row back to LIVE, and orients the API scoreline to the bracket's home/away so
// the live row and the eventual FINAL row read the same way (no flip at the whistle).
export async function upsertKnockoutDisplayFromApi(
  tournamentId: string,
  matchNo: number,
  input: {
    apiHomeCode: string;
    apiAwayCode: string;
    apiHomeScore: number | null;
    apiAwayScore: number | null;
    elapsed?: number | null;
  },
): Promise<{ applied: boolean; matchId: string | null }> {
  const [match, tournament] = await Promise.all([
    prisma.match.findUnique({
      where: { tournamentId_matchNo: { tournamentId, matchNo } },
      select: { id: true, result: { select: { source: true, status: true } } },
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { officialResults: true },
    }),
  ]);
  if (!match || !tournament) return { applied: false, matchId: match?.id ?? null };
  // A manual entry is authoritative; never overwrite it.
  if (match.result?.source === "MANUAL") return { applied: false, matchId: match.id };
  // Monotonic: a finished match stays finished even if the feed re-reports it live.
  if (match.result?.status === "FINAL") return { applied: false, matchId: match.id };

  // Orient the scoreline to the bracket's home/away so it matches the eventual FINAL
  // row. The pair map guarantees apiHomeCode is one of the two seated teams.
  const slot = resolveBracket(asResults(tournament.officialResults))[matchNo];
  if (!slot?.home || !slot?.away) return { applied: false, matchId: match.id };
  const apiHomeIsBracketHome = input.apiHomeCode === slot.home;
  const homeScore = apiHomeIsBracketHome ? input.apiHomeScore : input.apiAwayScore;
  const awayScore = apiHomeIsBracketHome ? input.apiAwayScore : input.apiHomeScore;

  const row = {
    homeTeamCode: slot.home,
    awayTeamCode: slot.away,
    homeScore: homeScore ?? null,
    awayScore: awayScore ?? null,
    winnerCode: null,
    elapsed: input.elapsed ?? null,
    status: "LIVE" as const,
    source: "API" as const,
  };
  await prisma.result.upsert({
    where: { matchId: match.id },
    update: row,
    create: { matchId: match.id, ...row },
  });

  return { applied: true, matchId: match.id };
}

// Backfill Match.scheduledAt for group-stage matches that have no scheduled time
// yet (null). Called once per poll run; only writes where scheduledAt IS NULL.
export async function backfillGroupMatchScheduledAt(
  tournamentId: string,
  updates: Array<{ matchNo: number; scheduledAt: Date }>,
): Promise<void> {
  await Promise.all(
    updates.map(({ matchNo, scheduledAt }) =>
      prisma.match.updateMany({
        where: { tournamentId, matchNo, scheduledAt: null },
        data: { scheduledAt },
      }),
    ),
  );
}

export interface StandingsInput {
  groupFirst?: Record<string, TeamCode>;
  groupSecond?: Record<string, TeamCode>;
  thirdAdvance?: TeamCode[];
}

// Set group winners / runners-up / third-place advancers. Each team is validated
// against its group; advancers must be real teams. Patches are merged so the
// admin can submit one group (or just the advancers) at a time.
export async function setGroupStandings(
  tournamentId: string,
  input: StandingsInput,
): Promise<Results> {
  return withAnswerKeyLock(tournamentId, async (tx) => {
    const current = await loadAnswerKey(tournamentId, tx);

    const validatePlacement = (map: Record<string, TeamCode> | undefined) => {
      const out: Record<string, TeamCode> = {};
      for (const [g, raw] of Object.entries(map ?? {})) {
        const code = (raw || "").toUpperCase();
        if (!code) continue;
        if (!GROUPS[g]) throw new Error(`Unknown group "${g}"`);
        if (!GROUPS[g].includes(code)) throw new Error(`${code} is not in group ${g}`);
        out[g] = code;
      }
      return out;
    };

    let thirdAdvance = current.thirdAdvance;
    if (input.thirdAdvance) {
      thirdAdvance = input.thirdAdvance
        .map((c) => (c || "").toUpperCase())
        .filter((c) => c && TEAMS[c]);
    }

    const next: Results = {
      ...current,
      groupFirst: { ...current.groupFirst, ...validatePlacement(input.groupFirst) },
      groupSecond: { ...current.groupSecond, ...validatePlacement(input.groupSecond) },
      thirdAdvance,
    };

    // Reject a self-contradictory answer key (e.g. a team placed twice) before it
    // can silently corrupt scoring for the whole pool.
    const conflict = findStandingsConflict(next);
    if (conflict) throw new Error(conflict);

    await writeAnswerKey(tournamentId, next, tx);
    return next;
  });
}

// Promote every group whose six matches are all FINAL into the official answer
// key: its determinate 1st/2nd (and, once the whole stage is done, the best-8
// thirds). Admin entries always win — only empty official slots are filled — so a
// manually-corrected standing is never clobbered. Display-only and scoring both
// then read these as official, and the knockout bracket resolves from them.
//
// Idempotent: re-running once a group is already promoted changes nothing. The
// caller runs recomputeTournamentPools afterwards so pools rescore against the
// freshly-promoted key. Returns the group letters newly written this call.
export async function promoteCompletedGroupsToOfficial(tournamentId: string): Promise<string[]> {
  const finalResults = await prisma.result.findMany({
    where: { status: "FINAL", match: { tournamentId, matchNo: { lte: 72 } } },
    select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true },
  });
  const rows: GroupResultRow[] = [];
  for (const r of finalResults) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore == null || r.awayScore == null) continue;
    rows.push({
      homeCode: r.homeTeamCode,
      awayCode: r.awayTeamCode,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }

  const promoted = promoteCompletedGroups(rows);
  if (
    Object.keys(promoted.groupFirst).length === 0 &&
    Object.keys(promoted.groupSecond).length === 0 &&
    promoted.thirdAdvance.length === 0
  ) {
    return [];
  }

  return withAnswerKeyLock(tournamentId, async (tx) => {
    const current = await loadAnswerKey(tournamentId, tx);
    const groupFirst = { ...current.groupFirst };
    const groupSecond = { ...current.groupSecond };
    const added: string[] = [];

    for (const [g, code] of Object.entries(promoted.groupFirst)) {
      if (!groupFirst[g]) {
        groupFirst[g] = code;
        added.push(g);
      }
    }
    for (const [g, code] of Object.entries(promoted.groupSecond)) {
      if (!groupSecond[g]) groupSecond[g] = code;
    }
    const thirdAdvance =
      !current.thirdAdvance?.length && promoted.thirdAdvance.length
        ? promoted.thirdAdvance
        : current.thirdAdvance;

    // Nothing actually changed (everything was already official) → no write.
    const changed =
      added.length > 0 ||
      thirdAdvance !== current.thirdAdvance ||
      !sameMap(groupSecond, current.groupSecond);
    if (!changed) return [];

    const next: Results = { ...current, groupFirst, groupSecond, thirdAdvance };
    // Guard against an inconsistent key (a team placed twice) corrupting scoring;
    // skip rather than throw so an automated poll never hard-fails on a fluke.
    const conflict = findStandingsConflict(next);
    if (conflict) {
      console.error(`promoteCompletedGroups skipped — ${conflict}`);
      return [];
    }

    await writeAnswerKey(tournamentId, next, tx);
    return added;
  });
}

function sameMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

// Set tournament awards (player / young / golden boot / goal) — free text.
export async function setAwards(
  tournamentId: string,
  awards: Partial<Awards>,
): Promise<Results> {
  return withAnswerKeyLock(tournamentId, async (tx) => {
    const current = await loadAnswerKey(tournamentId, tx);
    const next: Results = {
      ...current,
      awards: {
        ...current.awards,
        ...Object.fromEntries(
          Object.entries(awards).map(([k, v]) => [k, (v ?? "").trim()]),
        ),
      },
    };
    await writeAnswerKey(tournamentId, next, tx);
    return next;
  });
}

// Recompute every pool under a tournament and notify each. Returns the count.
// One pool's failure must not freeze standings for every later pool, so each
// recompute is isolated; failures are logged and rethrown only if all failed.
export async function recomputeTournamentPools(
  tournamentId: string,
  push?: ApnsPayload,
): Promise<number> {
  const pools = await prisma.pool.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  let failures = 0;
  for (const p of pools) {
    try {
      await recomputePool(p.id);
      await notifyPool(p.id, "result");
      // Native push is best-effort and additive to the in-app SSE event: a
      // failure here is swallowed inside sendPushToPool, so it never counts as a
      // recompute failure or blocks the next pool.
      if (push) await sendPushToPool(p.id, push);
    } catch (err) {
      failures += 1;
      console.error(`recomputePool failed for pool ${p.id}:`, err);
    }
  }
  if (failures > 0 && failures === pools.length) {
    throw new Error(`recompute failed for all ${failures} pool(s)`);
  }

  // Standalone brackets (poolId == null) — solo + Challenge entries — score
  // against the same answer key but live outside any pool, so rescore them too.
  // Best-effort and isolated: a failure here must not undo the pool recomputes.
  try {
    await recomputeStandalone(tournamentId);
  } catch (err) {
    console.error(`recomputeStandalone failed for tournament ${tournamentId}:`, err);
  }

  return pools.length - failures;
}

interface ResultRowData {
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens?: number | null;
  awayPens?: number | null;
  winnerCode: string;
  final: boolean;
  source: "API" | "MANUAL";
}

// Upsert the display Result row for a match. Manual entries always win over API.
async function mirrorResultRow(
  db: Db,
  tournamentId: string,
  matchNo: number,
  data: ResultRowData,
): Promise<void> {
  const match = await db.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: { id: true },
  });
  if (!match) return;

  // Inlined (not extracted to a const) so Prisma's input types contextually
  // type the status/source string literals as their enums rather than `string`.
  const status = data.final ? "FINAL" : "LIVE";
  await db.result.upsert({
    where: { matchId: match.id },
    update: {
      homeTeamCode: data.homeTeamCode,
      awayTeamCode: data.awayTeamCode,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      homePens: data.homePens ?? null,
      awayPens: data.awayPens ?? null,
      winnerCode: data.winnerCode,
      status,
      source: data.source,
    },
    create: {
      matchId: match.id,
      homeTeamCode: data.homeTeamCode,
      awayTeamCode: data.awayTeamCode,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      homePens: data.homePens ?? null,
      awayPens: data.awayPens ?? null,
      winnerCode: data.winnerCode,
      status,
      source: data.source,
    },
  });
  await db.match.update({ where: { id: match.id }, data: { scored: data.final } });
}
