// Presentation model for the public bracket + group-standings display. Pure: it
// maps the tested resolveBracket() output + stored scores into labelled rounds,
// so the page component stays dumb.

import { resolveBracket } from "./bracket";
import { overlayProvisional } from "./group-provisional";
import { GROUPS, TEAMS, R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";
import { computeGroupTables, provisionalStandings, type GroupResultRow, type GroupTableRow } from "./group-table";
import { slotLabel, KNOCKOUT_SLOT_REFS } from "./slot-label";
import { matchTag, roundLabel, type RoundCode } from "./rounds";
import { kickoffFor, venueFor } from "@/lib/scoring/schedule";
import type { Results } from "@/lib/scoring/types";
import type { ImpliedProbs } from "@/lib/odds/map";

// Earliest kickoff among a group's six matches. Groups are laid out A–L with six
// matches each in matchNo order (group at index i owns matchNos i*6+1 … i*6+6),
// matching the seed. Returns an ISO string, or null if none are scheduled.
function groupFirstMatchAt(groupIndex: number): string | null {
  let earliest: number | null = null;
  for (let n = groupIndex * 6 + 1; n <= groupIndex * 6 + 6; n++) {
    const d = kickoffFor(n);
    if (d && (earliest === null || d.getTime() < earliest)) earliest = d.getTime();
  }
  return earliest === null ? null : new Date(earliest).toISOString();
}

export interface BracketMatch {
  matchNo: number;
  homeCode: string | null;
  awayCode: string | null;
  home: string;
  away: string;
  // True when the seated team comes from a live provisional projection (the early
  // builder window) rather than the official answer key. Display-only — never scored.
  homeProjected: boolean;
  awayProjected: boolean;
  winnerCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  live: boolean;
  tag: string; // per-match knockout tag, e.g. "R32-1"
  scheduledAt: string | null; // ISO kickoff
  venue: string | null;
  city: string | null;
  cityToken: string | null;
  // Win/draw/away implied probabilities, oriented to this card's home. Null until the
  // odds poll has a price for the match (knockout cards once the matchup is concrete).
  odds: ImpliedProbs | null;
}

export interface BracketRound {
  code: RoundCode;
  label: string;
  matches: BracketMatch[];
}

export interface GroupStanding {
  group: string;
  first: string | null;
  second: string | null;
  table: GroupTableRow[];
  provisional: boolean;
  started: boolean; // any match in the group has been played
  firstMatchAt: string | null; // ISO kickoff of the group's earliest match
}

export interface ThirdPlaceRow extends GroupTableRow {
  group: string;
  advancing: boolean;
}

export interface BracketView {
  rounds: BracketRound[];
  groups: GroupStanding[];
  thirds: string[];
  thirdsTable: ThirdPlaceRow[];
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
  opts: { projectBracket?: boolean } = {},
  odds: Map<number, ImpliedProbs> = new Map(),
): BracketView {
  // Always compute tables (computeGroupTables seeds all 4 teams at 0 with no rows),
  // so every group renders a full, same-size table whether it has played or not.
  const tables = computeGroupTables(groupRows);
  const provisional = provisionalStandings(tables);

  // The bracket seats teams from the official answer key. When projection is on
  // (the early-builder window), overlay live provisional standings so a uniquely-
  // decided group winner/runner-up/third fills its R32 slot ahead of the official
  // key — display only, never scored. We keep the official-only resolution to mark
  // which seated teams are projected vs confirmed.
  const officialBracket = resolveBracket(results);
  const bracket = opts.projectBracket
    ? resolveBracket(overlayProvisional(results, provisional))
    : officialBracket;

  const row = (matchNo: number): BracketMatch => {
    const m = bracket[matchNo];
    const o = officialBracket[matchNo];
    const s = scores.get(matchNo);
    const refs = KNOCKOUT_SLOT_REFS[matchNo];
    const v = venueFor(matchNo);
    return {
      matchNo,
      homeCode: m?.home ?? null,
      awayCode: m?.away ?? null,
      // Real team once known, else the humanized feeder slot ("1A", "SF1") not "TBD".
      home: m?.home ? teamName(m.home) : slotLabel(refs?.[0]),
      away: m?.away ? teamName(m.away) : slotLabel(refs?.[1]),
      // Projected when the overlay seated a team the official key hasn't confirmed.
      homeProjected: Boolean(m?.home) && !o?.home,
      awayProjected: Boolean(m?.away) && !o?.away,
      winnerCode: m?.winner ?? null,
      homeScore: s?.homeScore ?? null,
      awayScore: s?.awayScore ?? null,
      live: s?.status === "LIVE",
      tag: matchTag(matchNo),
      scheduledAt: kickoffFor(matchNo)?.toISOString() ?? null,
      venue: v?.venue ?? null,
      city: v?.city ?? null,
      cityToken: v?.cityToken ?? null,
      odds: odds.get(matchNo) ?? null,
    };
  };

  const round = (code: RoundCode, matches: BracketMatch[]): BracketRound => ({
    code,
    label: roundLabel(code),
    matches,
  });
  const rounds: BracketRound[] = [
    round("R32", R32.map((m) => row(m.id))),
    round("R16", R16.map((m) => row(m.id))),
    round("QF", QF.map((m) => row(m.id))),
    round("SF", SF.map((m) => row(m.id))),
    round("BRONZE", [row(BRONZE.id)]),
    round("FINAL", [row(FINAL.id)]),
  ];

  const groups: GroupStanding[] = Object.keys(GROUPS).map((g, i) => {
    const officialFirst = results.groupFirst?.[g];
    const isProvisional = !officialFirst && Boolean(provisional.groupFirst[g]);
    const firstCode = officialFirst ?? provisional.groupFirst[g];
    const secondCode = officialFirst ? results.groupSecond?.[g] : provisional.groupSecond[g];
    const table = tables[g] ?? [];
    return {
      group: g,
      first: firstCode ? teamName(firstCode) : null,
      second: secondCode ? teamName(secondCode) : null,
      table,
      provisional: isProvisional,
      started: table.some((r) => r.played > 0),
      firstMatchAt: groupFirstMatchAt(i),
    };
  });

  const thirds = (results.thirdAdvance ?? []).map((c) => teamName(c));

  const thirdAdvanceSet = new Set(provisional.thirdAdvance);
  const thirdsTable: ThirdPlaceRow[] = Object.entries(tables)
    .flatMap(([g, table]) =>
      table
        .filter((r) => r.rank === 3)
        .map((r) => ({ ...r, group: g, advancing: thirdAdvanceSet.has(r.code) })),
    )
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group));

  return { rounds, groups, thirds, thirdsTable, awards: results.awards };
}
