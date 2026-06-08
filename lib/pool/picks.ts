// Conversion between the scoring `Submission`/`Picks` shapes and the flat DB
// `Pick` rows. Pick rows mirror the CSV long-format columns exactly
// (section, category, key, code, teamOrValue), so we reuse the same row
// builder/parser the CSV path uses — guaranteeing import, export, and scoring
// all agree.

import {
  submissionToRows,
  csvRowsToSubmission,
  CSV_HEADER,
} from "@/lib/scoring/csv";
import type { Submission } from "@/lib/scoring/types";

export interface PickRow {
  section: string; // "group_stage", "round_of_32", …
  category: string; // "Group A", "M73", "advancer", "award" — carries group/match key
  key: string;
  code: string;
  teamOrValue: string;
}

// A submission -> DB Pick rows. Contestant info lives on the Entry, so those
// rows are dropped here.
export function submissionToPickRows(sub: Submission): PickRow[] {
  // submissionToRows column order: section, category, key, code, team_or_value, match_date
  return submissionToRows(sub)
    .slice(1) // drop header
    .filter((r) => r[0] !== "contestant")
    .map((r) => ({
      section: r[0],
      category: r[1],
      key: r[2],
      code: r[3],
      teamOrValue: r[4],
    }));
}

// DB Pick rows -> a Submission (via the CSV parser, the canonical decoder).
export function pickRowsToSubmission(
  rows: PickRow[],
  contestant: Submission["contestant"] = { name: "", email: "", tiebreak: "" },
): Submission {
  const csvRows: string[][] = [CSV_HEADER.slice()];
  csvRows.push(["contestant", "info", "name", "", contestant.name, ""]);
  csvRows.push(["contestant", "info", "email", "", contestant.email, ""]);
  csvRows.push(["contestant", "info", "tiebreaker_goals_in_final", "", contestant.tiebreak, ""]);
  for (const r of rows) {
    csvRows.push([r.section, r.category, r.key, r.code, r.teamOrValue, ""]);
  }
  const sub = csvRowsToSubmission(csvRows);
  if (!sub) throw new Error("Failed to decode pick rows into a submission");
  // csvRowsToSubmission reads contestant from the rows we injected above.
  return sub;
}
