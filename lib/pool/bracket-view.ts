// Presentation model for the public bracket + group-standings display. Pure: it
// maps the tested resolveBracket() output + stored scores into labelled rounds,
// so the page component stays dumb.

import { resolveBracket } from "./bracket";
import { GROUPS, TEAMS, R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";
import { computeGroupTables, provisionalStandings, type GroupResultRow, type GroupTableRow } from "./group-table";
import type { Results } from "@/lib/scoring/types";

export interface BracketMatch {
  matchNo: number;
  homeCode: string | null;
  awayCode: string | null;
  home: string;
  away: string;
  winnerCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  live: boolean;
}

export interface BracketRound {
  label: string;
  matches: BracketMatch[];
}

export interface GroupStanding {
  group: string;
  first: string | null;
  second: string | null;
  table: GroupTableRow[];
  provisional: boolean;
}

export interface BracketView {
  rounds: BracketRound[];
  groups: GroupStanding[];
  thirds: string[];
  awards: Results["awards"];
}

export interface MatchScore {
  homeScore: number | null;
  awayScore: number | null;
  status?: string | null;
}

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

export function buildBracketView(
  results: Results,
  scores: Map<number, MatchScore> = new Map(),
  groupRows: GroupResultRow[] = [],
): BracketView {
  const bracket = resolveBracket(results);

  const row = (matchNo: number): BracketMatch => {
    const m = bracket[matchNo];
    const s = scores.get(matchNo);
    return {
      matchNo,
      homeCode: m?.home ?? null,
      awayCode: m?.away ?? null,
      home: teamName(m?.home),
      away: teamName(m?.away),
      winnerCode: m?.winner ?? null,
      homeScore: s?.homeScore ?? null,
      awayScore: s?.awayScore ?? null,
      live: s?.status === "LIVE",
    };
  };

  const rounds: BracketRound[] = [
    { label: "Round of 32", matches: R32.map((m) => row(m.id)) },
    { label: "Round of 16", matches: R16.map((m) => row(m.id)) },
    { label: "Quarter-finals", matches: QF.map((m) => row(m.id)) },
    { label: "Semi-finals", matches: SF.map((m) => row(m.id)) },
    { label: "Third-place play-off", matches: [row(BRONZE.id)] },
    { label: "Final", matches: [row(FINAL.id)] },
  ];

  const hasGroupRows = groupRows.length > 0;
  const tables = hasGroupRows ? computeGroupTables(groupRows) : {};
  const provisional = hasGroupRows ? provisionalStandings(tables) : { groupFirst: {}, groupSecond: {}, thirdAdvance: [] };
  const groups: GroupStanding[] = Object.keys(GROUPS).map((g) => {
    const officialFirst = results.groupFirst?.[g];
    const isProvisional = !officialFirst && Boolean(provisional.groupFirst[g]);
    const firstCode = officialFirst ?? provisional.groupFirst[g];
    const secondCode = officialFirst ? results.groupSecond?.[g] : provisional.groupSecond[g];
    return {
      group: g,
      first: firstCode ? teamName(firstCode) : null,
      second: secondCode ? teamName(secondCode) : null,
      table: tables[g] ?? [],
      provisional: isProvisional,
    };
  });

  const thirds = (results.thirdAdvance ?? []).map((c) => teamName(c));

  return { rounds, groups, thirds, awards: results.awards };
}
