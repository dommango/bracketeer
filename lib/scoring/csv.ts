// CSV parsing + serialization for the long-format picks files produced by the
// original WorldCup2026Bracket.html. Ported verbatim so submissions round-trip
// byte-for-byte (modulo the optional UTF-8 BOM).

import { GROUPS, TEAMS, R32, R16, QF, SF, FINAL } from "./data";
import { emptyPicks, type Submission } from "./types";

// Minimal RFC 4180 parser: handles quoted fields, escaped quotes, CRLF/LF, and
// strips an optional UTF-8 BOM. Returns an array of row arrays.
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

const AWARD_MAP: Record<string, keyof Submission["picks"]["awards"]> = {
  player_of_the_tournament: "player",
  young_player_of_the_tournament: "young",
  golden_boot: "boot",
  goal_of_the_tournament: "goal",
};

const KNOCKOUT_SECTIONS = new Set([
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "final",
]);

// Convert parsed CSV rows (the schema exportCsv() produces) into the
// { contestant, picks } shape. Returns null when required columns are missing.
export function csvRowsToSubmission(rows: string[][]): Submission | null {
  if (!rows || rows.length < 2) return null;
  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const k of ["section", "category", "key", "code", "team_or_value", "match_date"]) {
    idx[k] = header.indexOf(k);
  }
  if (idx.section < 0 || idx.key < 0) return null;

  const sub: Submission = {
    contestant: { name: "", email: "", tiebreak: "" },
    picks: emptyPicks(),
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((v) => !v)) continue;
    const section = (row[idx.section] || "").trim().toLowerCase();
    const category = (row[idx.category] || "").trim();
    const key = (row[idx.key] || "").trim().toLowerCase();
    const code = (row[idx.code] || "").trim().toUpperCase();
    const val = (row[idx.team_or_value] || "").trim();

    if (section === "contestant") {
      if (key === "name") sub.contestant.name = val;
      else if (key === "email") sub.contestant.email = val;
      else if (key === "tiebreaker_goals_in_final") sub.contestant.tiebreak = val;
    } else if (section === "group_stage") {
      const m = category.match(/group\s+([a-l])/i);
      if (!m || !code) continue;
      const g = m[1].toUpperCase();
      if (key === "1st") sub.picks.groupFirst[g] = code;
      else if (key === "2nd") sub.picks.groupSecond[g] = code;
    } else if (section === "third_place_advancers") {
      if (code) sub.picks.thirdAdvance.push(code);
    } else if (KNOCKOUT_SECTIONS.has(section)) {
      const m = category.match(/^M(\d+)/i);
      if (!m || !code) continue;
      sub.picks.knockout[+m[1]] = code;
    } else if (section === "player_awards") {
      const k = AWARD_MAP[key];
      if (k) sub.picks.awards[k] = val;
    }
  }
  return sub;
}

export const CSV_HEADER = ["section", "category", "key", "code", "team_or_value", "match_date"];

// Build the full long-format rows (including header) for a submission — the exact
// row set exportCsv() produces, minus serialization. This is the single source of
// truth shared by the CSV serializer and the DB Pick mapping.
export function submissionToRows(sub: Submission): string[][] {
  const teamLabel = (code: string) => (code && TEAMS[code] ? TEAMS[code] : "");
  const rows: string[][] = [CSV_HEADER.slice()];

  rows.push(["contestant", "info", "name", "", sub.contestant.name || "", ""]);
  rows.push(["contestant", "info", "email", "", sub.contestant.email || "", ""]);
  rows.push([
    "contestant",
    "info",
    "tiebreaker_goals_in_final",
    "",
    sub.contestant.tiebreak || "",
    "",
  ]);

  for (const g of Object.keys(GROUPS)) {
    const f = sub.picks.groupFirst[g] || "";
    const s = sub.picks.groupSecond[g] || "";
    rows.push(["group_stage", `Group ${g}`, "1st", f, teamLabel(f), ""]);
    rows.push(["group_stage", `Group ${g}`, "2nd", s, teamLabel(s), ""]);
  }

  const thirds = sub.picks.thirdAdvance || [];
  for (let i = 0; i < 8; i++) {
    const code = thirds[i] || "";
    rows.push(["third_place_advancers", "advancer", `slot_${i + 1}`, code, teamLabel(code), ""]);
  }

  const roundDefs: [string, { id: number; date: string }[]][] = [
    ["round_of_32", R32],
    ["round_of_16", R16],
    ["quarterfinals", QF],
    ["semifinals", SF],
    ["final", [FINAL]],
  ];
  for (const [section, matches] of roundDefs) {
    for (const m of matches) {
      const w = sub.picks.knockout[m.id] || "";
      rows.push([section, `M${m.id}`, "winner_pick", w, teamLabel(w), m.date]);
    }
  }

  rows.push(["player_awards", "award", "player_of_the_tournament", "", sub.picks.awards.player || "", ""]);
  rows.push(["player_awards", "award", "young_player_of_the_tournament", "", sub.picks.awards.young || "", ""]);
  rows.push(["player_awards", "award", "golden_boot", "", sub.picks.awards.boot || "", ""]);
  rows.push(["player_awards", "award", "goal_of_the_tournament", "", sub.picks.awards.goal || "", ""]);

  return rows;
}

// Serialize a submission to the exact long-format CSV exportCsv() produces,
// including the leading UTF-8 BOM. Used for round-trip verification and re-export.
export function submissionToCsv(sub: Submission): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = submissionToRows(sub)
    .map((r) => r.map(esc).join(","))
    .join("\r\n") + "\r\n";
  return "﻿" + csv;
}
