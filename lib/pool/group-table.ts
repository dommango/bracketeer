// Live group-table engine. Pure and DB-free. NOT part of the byte-parity ported
// scoring engine in lib/scoring (the original tool never computed a table) — it
// powers display + provisional standings only, so it lives in lib/pool alongside
// projected.ts. Ranks each group with the FIFA chain minus fair-play/lots:
// points -> goal difference -> goals scored -> head-to-head (pts/GD/goals among
// the still-tied subset). Inseparable teams share a rank and are flagged tied.

import { GROUPS } from "@/lib/scoring/data";
import type { GroupLetter, TeamCode, Results } from "@/lib/scoring/types";

export interface GroupResultRow {
  homeCode: TeamCode;
  awayCode: TeamCode;
  homeScore: number;
  awayScore: number;
  matchNo?: number; // for chronological form ordering; falls back to input order
}

export interface GroupTableRow {
  code: TeamCode;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  rank: number;
  tied: boolean;
  form: string; // actual W/D/L sequence in match order, most-recent last (e.g. "WDL")
}

interface Stat {
  code: TeamCode;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

// code -> group letter, built once from the static GROUPS map.
const TEAM_GROUP: Record<string, GroupLetter> = (() => {
  const map: Record<string, GroupLetter> = {};
  for (const [g, codes] of Object.entries(GROUPS)) {
    for (const c of codes) map[c] = g;
  }
  return map;
})();

const points = (s: Stat): number => s.w * 3 + s.d;
const goalDiff = (s: Stat): number => s.gf - s.ga;

// pts desc, GD desc, goals-for desc. Returns <0 if a should rank ahead of b.
function cmpStats(a: Stat, b: Stat): number {
  return points(b) - points(a) || goalDiff(b) - goalDiff(a) || b.gf - a.gf;
}

function tally(codes: TeamCode[], matches: GroupResultRow[]): Map<TeamCode, Stat> {
  const m = new Map<TeamCode, Stat>();
  for (const c of codes) m.set(c, { code: c, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
  for (const mt of matches) {
    const h = m.get(mt.homeCode);
    const a = m.get(mt.awayCode);
    if (!h || !a) continue;
    h.played += 1;
    a.played += 1;
    h.gf += mt.homeScore;
    h.ga += mt.awayScore;
    a.gf += mt.awayScore;
    a.ga += mt.homeScore;
    if (mt.homeScore > mt.awayScore) {
      h.w += 1;
      a.l += 1;
    } else if (mt.homeScore < mt.awayScore) {
      a.w += 1;
      h.l += 1;
    } else {
      h.d += 1;
      a.d += 1;
    }
  }
  return m;
}

// Split a sorted list into clusters of consecutive elements that compare equal.
function clusterBy(sorted: TeamCode[], equal: (a: TeamCode, b: TeamCode) => boolean): TeamCode[][] {
  const clusters: TeamCode[][] = [];
  for (const code of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && equal(last[0], code)) last.push(code);
    else clusters.push([code]);
  }
  return clusters;
}

// Order a subset into ranked tie-clusters. Criteria 1-3 (pts/GD/goals) use the
// full group stats; any subset still tied on those is re-ranked by head-to-head
// (the same comparison over only the matches among that subset). A subset that
// head-to-head also cannot separate is returned as one tied cluster. Recursing
// on each head-to-head sub-cluster gives FIFA's "restart among the smaller
// still-tied set" behaviour; every recursion shrinks the subset, so it ends.
function order(
  subset: TeamCode[],
  stats: Map<TeamCode, Stat>,
  allMatches: GroupResultRow[],
): TeamCode[][] {
  if (subset.length <= 1) return subset.length ? [subset] : [];

  const byOverall = [...subset].sort((a, b) => cmpStats(stats.get(a)!, stats.get(b)!));
  const overallClusters = clusterBy(
    byOverall,
    (a, b) => cmpStats(stats.get(a)!, stats.get(b)!) === 0,
  );
  if (overallClusters.length > 1) {
    return overallClusters.flatMap((c) => order(c, stats, allMatches));
  }

  // Whole subset equal on 1-3 → head-to-head among just these teams.
  const h2hMatches = allMatches.filter(
    (mt) => subset.includes(mt.homeCode) && subset.includes(mt.awayCode),
  );
  const h2hStats = tally(subset, h2hMatches);
  const byH2H = [...subset].sort((a, b) => cmpStats(h2hStats.get(a)!, h2hStats.get(b)!));
  const h2hClusters = clusterBy(
    byH2H,
    (a, b) => cmpStats(h2hStats.get(a)!, h2hStats.get(b)!) === 0,
  );
  if (h2hClusters.length > 1) {
    return h2hClusters.flatMap((c) => order(c, stats, allMatches));
  }

  return [subset]; // inseparable → one tied cluster
}

// A team's actual results in match order (most-recent last), as a W/D/L string.
// Ordered by matchNo when present, else by the order rows were supplied.
function teamForm(code: TeamCode, matches: GroupResultRow[]): string {
  return matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.homeCode === code || m.awayCode === code)
    .sort((a, b) => (a.m.matchNo ?? a.i) - (b.m.matchNo ?? b.i))
    .map(({ m }) => {
      const gf = m.homeCode === code ? m.homeScore : m.awayScore;
      const ga = m.homeCode === code ? m.awayScore : m.homeScore;
      return gf > ga ? "W" : gf < ga ? "L" : "D";
    })
    .join("");
}

function buildTable(g: GroupLetter, matches: GroupResultRow[]): GroupTableRow[] {
  const codes = GROUPS[g];
  const stats = tally(codes, matches);
  const clusters = order([...codes], stats, matches);

  const rows: GroupTableRow[] = [];
  let rank = 1;
  for (const cluster of clusters) {
    const tied = cluster.length > 1;
    for (const code of cluster) {
      const s = stats.get(code)!;
      rows.push({
        code,
        played: s.played,
        w: s.w,
        d: s.d,
        l: s.l,
        gf: s.gf,
        ga: s.ga,
        gd: goalDiff(s),
        pts: points(s),
        rank,
        tied,
        form: teamForm(code, matches),
      });
    }
    rank += cluster.length;
  }
  return rows;
}

export function computeGroupTables(
  rows: GroupResultRow[],
): Record<GroupLetter, GroupTableRow[]> {
  const byGroup = new Map<GroupLetter, GroupResultRow[]>();
  for (const r of rows) {
    if (r.homeScore == null || r.awayScore == null) continue;
    const g = TEAM_GROUP[r.homeCode];
    if (!g || TEAM_GROUP[r.awayCode] !== g) continue; // not a valid same-group pair
    const list = byGroup.get(g) ?? [];
    list.push(r);
    byGroup.set(g, list);
  }

  const out: Record<GroupLetter, GroupTableRow[]> = {};
  for (const g of Object.keys(GROUPS) as GroupLetter[]) {
    out[g] = buildTable(g, byGroup.get(g) ?? []);
  }
  return out;
}

export type ProvisionalStandings = Pick<Results, "groupFirst" | "groupSecond" | "thirdAdvance">;

// The single team at a given rank, or null if that rank is shared (tied) or absent.
function uniqueAtRank(table: GroupTableRow[], rank: number): GroupTableRow | null {
  const at = table.filter((r) => r.rank === rank);
  return at.length === 1 ? at[0] : null;
}

const thirdsKey = (r: GroupTableRow): string => `${r.pts}|${r.gd}|${r.gf}`;

// Top `take` third-place teams by pts -> GD -> goals. If a tie group straddles
// the cutoff (more equal teams than remaining slots), none of those tied teams
// are included — we never guess which of equally-ranked thirds advance.
function selectBestThirds(candidates: GroupTableRow[], take: number): TeamCode[] {
  const sorted = [...candidates].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf,
  );
  const result: TeamCode[] = [];
  let i = 0;
  while (i < sorted.length && result.length < take) {
    const key = thirdsKey(sorted[i]);
    const block = sorted.filter((r) => thirdsKey(r) === key);
    if (result.length + block.length <= take) {
      result.push(...block.map((r) => r.code));
      i += block.length;
    } else {
      break; // tie block overflows the remaining slots → drop it entirely
    }
  }
  return result;
}

export function provisionalStandings(
  tables: Record<GroupLetter, GroupTableRow[]>,
): ProvisionalStandings {
  const groupFirst: Record<string, TeamCode> = {};
  const groupSecond: Record<string, TeamCode> = {};
  const thirdCandidates: GroupTableRow[] = [];

  for (const [g, table] of Object.entries(tables)) {
    const r1 = uniqueAtRank(table, 1);
    const r2 = uniqueAtRank(table, 2);
    const r3 = uniqueAtRank(table, 3);
    if (r1) groupFirst[g] = r1.code;
    if (r2) groupSecond[g] = r2.code;
    if (r3) thirdCandidates.push(r3);
  }

  return { groupFirst, groupSecond, thirdAdvance: selectBestThirds(thirdCandidates, 8) };
}
