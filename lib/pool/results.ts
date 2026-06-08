// Admin answer-key service. The tournament's officialResults is the single
// scoring source of truth (mirroring the original tool's RESULTS object); these
// functions patch it immutably, mirror knockout outcomes into Match/Result rows
// for display, and never recompute on their own — the caller decides when to run
// recomputeTournamentPools so a batch of edits triggers one recompute.

import { prisma } from "@/lib/db";
import { asResults, recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { resolveBracket, validateKnockoutWinner } from "@/lib/pool/bracket";
import { findStandingsConflict } from "@/lib/pool/standings";
import { GROUPS, TEAMS } from "@/lib/scoring/data";
import type { Results, TeamCode, Awards } from "@/lib/scoring/types";

async function loadAnswerKey(tournamentId: string): Promise<Results> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  return asResults(t.officialResults);
}

async function writeAnswerKey(tournamentId: string, next: Results): Promise<void> {
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { officialResults: next as unknown as object },
  });
}

export interface KnockoutInput {
  winnerCode: TeamCode;
  homeScore?: number | null;
  awayScore?: number | null;
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
  const current = await loadAnswerKey(tournamentId);
  const winner = (input.winnerCode || "").toUpperCase();

  const check = validateKnockoutWinner(current, matchNo, winner);
  if (!check.ok) throw new Error(check.reason ?? "Invalid knockout winner");

  const next: Results = {
    ...current,
    knockout: { ...current.knockout, [matchNo]: winner },
  };
  await writeAnswerKey(tournamentId, next);

  const slot = resolveBracket(next)[matchNo];
  await mirrorResultRow(tournamentId, matchNo, {
    homeTeamCode: slot?.home ?? null,
    awayTeamCode: slot?.away ?? null,
    homeScore: input.homeScore ?? null,
    awayScore: input.awayScore ?? null,
    winnerCode: winner,
    final: input.final ?? true,
    source: input.source ?? "MANUAL",
  });

  return next;
}

// API-sourced variant for the score poller. A manual entry is authoritative, so
// if a MANUAL Result already exists for this match we leave it untouched.
export async function setKnockoutResultFromApi(
  tournamentId: string,
  matchNo: number,
  input: Omit<KnockoutInput, "source">,
): Promise<{ applied: boolean }> {
  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: { result: { select: { source: true } } },
  });
  if (match?.result?.source === "MANUAL") return { applied: false };

  await setKnockoutResult(tournamentId, matchNo, { ...input, source: "API" });
  return { applied: true };
}

// Clear a previously-entered knockout winner (e.g. a mistaken entry).
export async function clearKnockoutResult(
  tournamentId: string,
  matchNo: number,
): Promise<Results> {
  const current = await loadAnswerKey(tournamentId);
  const knockout = { ...current.knockout };
  delete knockout[matchNo];
  const next: Results = { ...current, knockout };
  await writeAnswerKey(tournamentId, next);

  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: { id: true },
  });
  if (match) {
    await prisma.result.deleteMany({ where: { matchId: match.id } });
    await prisma.match.update({ where: { id: match.id }, data: { scored: false } });
  }
  return next;
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
  const current = await loadAnswerKey(tournamentId);

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

  await writeAnswerKey(tournamentId, next);
  return next;
}

// Set tournament awards (player / young / golden boot / goal) — free text.
export async function setAwards(
  tournamentId: string,
  awards: Partial<Awards>,
): Promise<Results> {
  const current = await loadAnswerKey(tournamentId);
  const next: Results = {
    ...current,
    awards: {
      ...current.awards,
      ...Object.fromEntries(
        Object.entries(awards).map(([k, v]) => [k, (v ?? "").trim()]),
      ),
    },
  };
  await writeAnswerKey(tournamentId, next);
  return next;
}

// Recompute every pool under a tournament and notify each. Returns the count.
export async function recomputeTournamentPools(tournamentId: string): Promise<number> {
  const pools = await prisma.pool.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  for (const p of pools) {
    await recomputePool(p.id);
    await notifyPool(p.id, "result");
  }
  return pools.length;
}

interface ResultRowData {
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerCode: string;
  final: boolean;
  source: "API" | "MANUAL";
}

// Upsert the display Result row for a match. Manual entries always win over API.
async function mirrorResultRow(
  tournamentId: string,
  matchNo: number,
  data: ResultRowData,
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: { id: true },
  });
  if (!match) return;

  // Inlined (not extracted to a const) so Prisma's input types contextually
  // type the status/source string literals as their enums rather than `string`.
  const status = data.final ? "FINAL" : "LIVE";
  await prisma.result.upsert({
    where: { matchId: match.id },
    update: {
      homeTeamCode: data.homeTeamCode,
      awayTeamCode: data.awayTeamCode,
      homeScore: data.homeScore,
      awayScore: data.awayScore,
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
      winnerCode: data.winnerCode,
      status,
      source: data.source,
    },
  });
  await prisma.match.update({ where: { id: match.id }, data: { scored: data.final } });
}
