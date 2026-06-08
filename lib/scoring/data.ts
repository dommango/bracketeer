// FIFA World Cup 2026 tournament data — ported verbatim from the friend group's
// WorldCup2026Bracket.html so that the new app's structure, IDs, and bracket
// topology match the picks people already submitted. Do not "correct" any
// quirk here without re-validating against the original tool's CSV exports.

import type { GroupLetter, TeamCode } from "./types";

export const TEAMS: Record<TeamCode, string> = {
  MEX: "Mexico",          RSA: "South Africa",  KOR: "Korea Republic", CZE: "Czechia",
  CAN: "Canada",          BIH: "Bosnia & Herzegovina", QAT: "Qatar",   SUI: "Switzerland",
  BRA: "Brazil",          MAR: "Morocco",       HAI: "Haiti",          SCO: "Scotland",
  USA: "USA",             PAR: "Paraguay",      AUS: "Australia",      TUR: "Türkiye",
  GER: "Germany",         CUW: "Curaçao",       CIV: "Côte d'Ivoire",  ECU: "Ecuador",
  NED: "Netherlands",     JPN: "Japan",         SWE: "Sweden",         TUN: "Tunisia",
  BEL: "Belgium",         EGY: "Egypt",         IRN: "IR Iran",        NZL: "New Zealand",
  ESP: "Spain",           CPV: "Cabo Verde",    KSA: "Saudi Arabia",   URU: "Uruguay",
  FRA: "France",          SEN: "Senegal",       IRQ: "Iraq",           NOR: "Norway",
  ARG: "Argentina",       ALG: "Algeria",       AUT: "Austria",        JOR: "Jordan",
  POR: "Portugal",        COD: "Congo DR",      UZB: "Uzbekistan",     COL: "Colombia",
  ENG: "England",         CRO: "Croatia",       GHA: "Ghana",          PAN: "Panama",
};

export const GROUPS: Record<GroupLetter, TeamCode[]> = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"],
};

// A Round-of-32 slot is either a literal group placement or a third-place slot
// drawn from one of the listed groups (resolved per FIFA's placement table).
export type R32Slot =
  | { pos: 1 | 2; group: GroupLetter }
  | { third: GroupLetter[] };

export interface R32Match {
  id: number;
  date: string;
  a: R32Slot;
  b: R32Slot;
}

export interface KnockoutMatch {
  id: number;
  date: string;
  a: number; // feeder match id
  b: number; // feeder match id
}

export const R32: R32Match[] = [
  { id: 73, date: "Sat Jun 27", a: { pos: 2, group: "A" }, b: { pos: 2, group: "B" } },
  { id: 74, date: "Sat Jun 27", a: { pos: 1, group: "E" }, b: { third: ["A", "B", "C", "D", "F"] } },
  { id: 75, date: "Sun Jun 28", a: { pos: 1, group: "F" }, b: { pos: 2, group: "C" } },
  { id: 76, date: "Sun Jun 28", a: { pos: 1, group: "C" }, b: { pos: 2, group: "F" } },
  { id: 77, date: "Mon Jun 29", a: { pos: 1, group: "I" }, b: { third: ["C", "D", "F", "G", "H"] } },
  { id: 78, date: "Mon Jun 29", a: { pos: 2, group: "E" }, b: { pos: 2, group: "I" } },
  { id: 79, date: "Tue Jun 30", a: { pos: 1, group: "A" }, b: { third: ["C", "E", "F", "H", "I"] } },
  { id: 80, date: "Tue Jun 30", a: { pos: 1, group: "L" }, b: { third: ["E", "H", "I", "J", "K"] } },
  { id: 81, date: "Tue Jun 30", a: { pos: 1, group: "D" }, b: { third: ["B", "E", "F", "I", "J"] } },
  { id: 82, date: "Tue Jun 30", a: { pos: 1, group: "G" }, b: { third: ["A", "E", "H", "I", "J"] } },
  { id: 83, date: "Wed Jul 1", a: { pos: 2, group: "K" }, b: { pos: 2, group: "L" } },
  { id: 84, date: "Wed Jul 1", a: { pos: 1, group: "H" }, b: { pos: 2, group: "J" } },
  { id: 85, date: "Wed Jul 1", a: { pos: 1, group: "B" }, b: { third: ["E", "F", "G", "I", "J"] } },
  { id: 86, date: "Thu Jul 2", a: { pos: 1, group: "J" }, b: { pos: 2, group: "H" } },
  { id: 87, date: "Thu Jul 2", a: { pos: 1, group: "K" }, b: { third: ["D", "E", "I", "J", "L"] } },
  { id: 88, date: "Fri Jul 3", a: { pos: 2, group: "D" }, b: { pos: 2, group: "G" } },
];

export const R16: KnockoutMatch[] = [
  { id: 89, date: "Sat Jul 4", a: 74, b: 77 },
  { id: 90, date: "Sat Jul 4", a: 73, b: 75 },
  { id: 91, date: "Sun Jul 5", a: 76, b: 78 },
  { id: 92, date: "Sun Jul 5", a: 79, b: 80 },
  { id: 93, date: "Mon Jul 6", a: 83, b: 84 },
  { id: 94, date: "Mon Jul 6", a: 81, b: 82 },
  { id: 95, date: "Tue Jul 7", a: 86, b: 88 },
  { id: 96, date: "Tue Jul 7", a: 85, b: 87 },
];

export const QF: KnockoutMatch[] = [
  { id: 97, date: "Thu Jul 9", a: 89, b: 90 },
  { id: 98, date: "Thu Jul 9", a: 93, b: 94 },
  { id: 99, date: "Fri Jul 10", a: 91, b: 92 },
  { id: 100, date: "Fri Jul 10", a: 95, b: 96 },
];

export const SF: KnockoutMatch[] = [
  { id: 101, date: "Tue Jul 14", a: 97, b: 98 },
  { id: 102, date: "Wed Jul 15", a: 99, b: 100 },
];

export const BRONZE = { id: 103, date: "Sat Jul 18", aLoser: 101, bLoser: 102 };
export const FINAL: KnockoutMatch = { id: 104, date: "Sun Jul 19", a: 101, b: 102 };

export const R32_BY_ID: Record<number, R32Match> = Object.fromEntries(
  R32.map((m) => [m.id, m]),
);

// Group stage matchups (each group plays all pairings — 6 matches).
export function groupMatchups(letter: GroupLetter): [TeamCode, TeamCode][] {
  const teams = GROUPS[letter];
  const out: [TeamCode, TeamCode][] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) out.push([teams[i], teams[j]]);
  return out;
}
