import { TEAMS } from "@/lib/scoring/data";

export interface ImpliedProbs {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
}

// Invert decimal prices and normalize so the three sum to 1 (strips the overround).
export function toImpliedProbs(dH: number, dD: number, dA: number): ImpliedProbs {
  const rH = 1 / dH, rD = 1 / dD, rA = 1 / dA;
  const total = rH + rD + rA;
  return { homeWinProb: rH / total, drawProb: rD / total, awayWinProb: rA / total };
}

export interface TwoWayProbs {
  overProb: number;
  underProb: number;
}

// Two-outcome (Over/Under) implied probs, normalized to sum to 1. Bad prices
// (zero/negative/NaN) yield 0/0 rather than letting Infinity/NaN reach the DB or UI.
export function toTwoWayProbs(dOver: number, dUnder: number): TwoWayProbs {
  if (!(dOver > 0) || !(dUnder > 0)) return { overProb: 0, underProb: 0 };
  const rOver = 1 / dOver, rUnder = 1 / dUnder;
  const total = rOver + rUnder;
  return { overProb: rOver / total, underProb: rUnder / total };
}

export interface OutrightProb {
  teamCode: string;
  decimal: number;
  winProb: number;
}

// Implied championship probability per team: invert each price and normalize
// across the whole field (futures overrounds are large, so normalization matters).
// Names that don't resolve to an internal code are dropped, never guessed.
export function toOutrightProbs(
  entries: Array<{ teamName: string; decimal: number }>,
): OutrightProb[] {
  const coded = entries
    .map((e) => ({ teamCode: normalizeTeam(e.teamName), decimal: e.decimal }))
    .filter((e): e is { teamCode: string; decimal: number } => e.teamCode != null && e.decimal > 0);
  const total = coded.reduce((sum, e) => sum + 1 / e.decimal, 0);
  if (total <= 0) return [];
  return coded.map((e) => ({
    teamCode: e.teamCode,
    decimal: e.decimal,
    winProb: 1 / e.decimal / total,
  }));
}

// Provider name -> our 3-letter code. Built from TEAMS (code->name) plus aliases
// for names The Odds API spells differently. Unknown names return null (skipped,
// never guessed); scripts/verify-odds.ts surfaces any unmatched name vs live data.
const ALIASES: Record<string, string> = {
  "South Korea": "KOR",
  "Korea Republic": "KOR",
  "United States": "USA",
  "USA": "USA",
  "Ivory Coast": "CIV",
  "Cote d'Ivoire": "CIV",
  "Côte d'Ivoire": "CIV",
  "Iran": "IRN",
  "IR Iran": "IRN",
  "DR Congo": "COD",
  "Congo DR": "COD",
  "Cape Verde": "CPV",
  "Cabo Verde": "CPV",
  "Curacao": "CUW",
  "Curaçao": "CUW",
  "South Africa": "RSA",
  "Saudi Arabia": "KSA",
  "New Zealand": "NZL",
  "Czech Republic": "CZE",
  "Turkey": "TUR",
};

const NAME_TO_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, name] of Object.entries(TEAMS)) m[name.toLowerCase()] = code;
  for (const [name, code] of Object.entries(ALIASES)) m[name.toLowerCase()] = code;
  return m;
})();

export function normalizeTeam(name: string): string | null {
  return NAME_TO_CODE[name.trim().toLowerCase()] ?? null;
}

export interface CodedMatch { matchNo: number; homeCode: string | null; awayCode: string | null }

export function resolveMatchNo(
  home: string,
  away: string,
  matches: CodedMatch[],
): number | null {
  const hit = matches.filter(
    (m) =>
      (m.homeCode === home && m.awayCode === away) ||
      (m.homeCode === away && m.awayCode === home),
  );
  return hit.length === 1 ? hit[0].matchNo : null;
}

export interface LiveState { status: string; homeScore: number | null; awayScore: number | null }

// LIVE-only: true when the team currently ahead was the pre-match underdog.
export function liveUpset(s: LiveState, p: ImpliedProbs): boolean {
  if (s.status !== "LIVE") return false;
  if (s.homeScore == null || s.awayScore == null) return false;
  if (s.homeScore === s.awayScore) return false;
  const homeAhead = s.homeScore > s.awayScore;
  return homeAhead ? p.homeWinProb < p.awayWinProb : p.awayWinProb < p.homeWinProb;
}
