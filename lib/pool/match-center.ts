// Pure Match-Center model: turn resolved match rows into a round-grouped,
// chronological fixture list with status + an optional "your pick" marker.
// DB-free so it's unit-testable; the prisma selector (getMatchCenter) lives in
// queries.ts and resolves team codes (group teams from the slot ref, knockout
// teams from resolveBracket / live Result rows) before calling in here.

import { TEAMS, GROUPS } from "@/lib/scoring/data";
import { ROUND_ORDER, roundLabel, isScoredKnockout, type RoundCode } from "@/lib/pool/rounds";
import { slotLabel } from "@/lib/pool/slot-label";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINAL";

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

// A side's display name: the real team once known, else the humanized feeder
// slot ("1A", "SF1", …) rather than a bare "TBD".
const sideName = (code: string | null | undefined, ref: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : slotLabel(ref);

// One resolved match as it comes out of the DB layer (teams already resolved to
// codes; scores/status from the Result row when present).
export interface MatchInput {
  matchNo: number;
  roundCode: string;
  scheduledAt: Date | null;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerCode: string | null;
  resultStatus: MatchStatus | null;
  elapsed?: number | null; // live match minute (from the API feed)
  homePens?: number | null; // shootout score when the tie went to penalties
  awayPens?: number | null;
  homeRef?: string | null; // feeder slot ref, for the placeholder name when unresolved
  awayRef?: string | null;
}

export interface MatchCenterSide {
  code: string | null;
  name: string;
  score: number | null;
}

export interface YourPick {
  code: string;
  name: string;
  correct: boolean | null; // null until the match is decided
}

export interface MatchCenterRow {
  matchNo: number;
  roundCode: string;
  scheduledAt: string | null; // ISO
  status: MatchStatus;
  elapsed: number | null; // live match minute when LIVE, else null
  homePens: number | null; // shootout score when the tie went to penalties
  awayPens: number | null;
  home: MatchCenterSide;
  away: MatchCenterSide;
  winnerCode: string | null;
  yourPick: YourPick | null;
}

export interface MatchCenterSection {
  roundCode: string;
  label: string;
  matches: MatchCenterRow[];
}

// A match is FINAL when the Result says so, or (no Result yet) when the answer
// key already records a winner. LIVE only ever comes from a live Result feed.
function statusOf(m: MatchInput): MatchStatus {
  if (m.resultStatus) return m.resultStatus;
  return m.winnerCode ? "FINAL" : "SCHEDULED";
}

function buildRow(m: MatchInput, yourKnockoutPicks: Record<number, string>): MatchCenterRow {
  const status = statusOf(m);

  let yourPick: YourPick | null = null;
  // A per-match winner pick only exists for scored knockout matches.
  if (isScoredKnockout(m.matchNo)) {
    const code = yourKnockoutPicks[m.matchNo];
    if (code) {
      yourPick = {
        code,
        name: teamName(code),
        correct: m.winnerCode ? code === m.winnerCode : null,
      };
    }
  }

  return {
    matchNo: m.matchNo,
    roundCode: m.roundCode,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    status,
    // Match minute is only meaningful while LIVE.
    elapsed: status === "LIVE" ? (m.elapsed ?? null) : null,
    homePens: m.homePens ?? null,
    awayPens: m.awayPens ?? null,
    home: { code: m.homeCode, name: sideName(m.homeCode, m.homeRef), score: m.homeScore },
    away: { code: m.awayCode, name: sideName(m.awayCode, m.awayRef), score: m.awayScore },
    winnerCode: m.winnerCode,
    yourPick,
  };
}

// Group matches into rounds (tournament order), each round ordered by match
// number — which is chronological within a round and across the tournament,
// since rounds never overlap in time. Empty rounds are dropped.
export function buildMatchCenter(
  matches: MatchInput[],
  yourKnockoutPicks: Record<number, string> = {},
): MatchCenterSection[] {
  const byRound = new Map<string, MatchCenterRow[]>();
  for (const m of matches) {
    const row = buildRow(m, yourKnockoutPicks);
    const list = byRound.get(m.roundCode);
    if (list) list.push(row);
    else byRound.set(m.roundCode, [row]);
  }

  const sections: MatchCenterSection[] = [];
  for (const code of ROUND_ORDER) {
    const rows = byRound.get(code);
    if (!rows || rows.length === 0) continue;
    rows.sort((a, b) => a.matchNo - b.matchNo);
    sections.push({ roundCode: code, label: roundLabel(code), matches: rows });
  }
  return sections;
}

// Group-Stage focused variant: produces one section per group letter (A–L)
// instead of one flat GROUP section, followed by knockout sections in round order.
// The group letter is derived from home/away team codes via the GROUPS lookup.
export function buildGroupCenterSections(
  matches: MatchInput[],
  yourKnockoutPicks: Record<number, string> = {},
): MatchCenterSection[] {
  const teamToGroup = new Map<string, string>();
  for (const [letter, teams] of Object.entries(GROUPS)) {
    for (const code of teams) teamToGroup.set(code, letter);
  }

  const groupMatches: MatchInput[] = [];
  const knockoutMatches: MatchInput[] = [];
  for (const m of matches) {
    if (m.roundCode === "GROUP") groupMatches.push(m);
    else knockoutMatches.push(m);
  }

  const byGroup = new Map<string, MatchCenterRow[]>();
  for (const m of groupMatches) {
    const row = buildRow(m, yourKnockoutPicks);
    const letter =
      teamToGroup.get(m.homeCode ?? "") ??
      teamToGroup.get(m.awayCode ?? "") ??
      "?";
    const list = byGroup.get(letter);
    if (list) list.push(row);
    else byGroup.set(letter, [row]);
  }

  const sections: MatchCenterSection[] = [];
  for (const letter of Object.keys(GROUPS)) {
    const rows = byGroup.get(letter);
    if (!rows || rows.length === 0) continue;
    rows.sort((a, b) => a.matchNo - b.matchNo);
    sections.push({ roundCode: "GROUP", label: `Group ${letter}`, matches: rows });
  }

  return [...sections, ...buildMatchCenter(knockoutMatches, yourKnockoutPicks)];
}

// Re-exported for the selector layer.
export type { RoundCode };
