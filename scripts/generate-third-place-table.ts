// Generate + validate lib/scoring/third-place-table.ts from FIFA's official
// WC2026 Annex C third-place placement table.
//
// Provenance: the table is transcribed verbatim from the raw wikitext of
// Wikipedia "Template:2026 FIFA World Cup third-place table", which reproduces
// Annex C of the FIFA World Cup 2026 Regulations (the 495 possible sets of the
// eight qualifying third-place groups → their Round-of-32 match assignments).
//
// Regenerate:
//   curl -sL "https://en.wikipedia.org/wiki/Template:2026_FIFA_World_Cup_third-place_table?action=raw" -o /tmp/tpt.wikitext
//   npx tsx scripts/generate-third-place-table.ts /tmp/tpt.wikitext lib/scoring/third-place-table.ts
//
// The script FAILS (non-zero exit, no output written) unless the parsed table
// passes every check: 495 rows numbered 1..495, full C(12,8) coverage, each row
// a legal bijection into the allowed group set of its match (per data.ts R32),
// the bold "advancing groups" cells equal to the assignment cells, and several
// independently-confirmed anchor rows. lib/scoring/third-place-table.test.ts
// re-checks coverage/bijection/anchors at CI time, so a corrupted regeneration
// cannot land silently.
import { readFileSync, writeFileSync } from "node:fs";

// Wikipedia assignment-column order (header "1A/1B/1D/1E/1G/1I/1K/1L vs") → our
// internal match numbers, left→right.
const WIKI_COL_TO_MATCH = [79, 85, 81, 74, 82, 77, 87, 80];
const MATCH_ORDER = [74, 77, 79, 80, 81, 82, 85, 87]; // canonical output order
// Legal third-place group set per match (mirrors data.ts R32 third slots).
const ALLOWED: Record<number, string[]> = {
  74: ["A", "B", "C", "D", "F"],
  77: ["C", "D", "F", "G", "H"],
  79: ["C", "E", "F", "H", "I"],
  80: ["E", "H", "I", "J", "K"],
  81: ["B", "E", "F", "I", "J"],
  82: ["A", "E", "H", "I", "J"],
  85: ["E", "F", "G", "I", "J"],
  87: ["D", "E", "I", "J", "L"],
};

const path = process.argv[2];
const out = process.argv[3];
if (!path) throw new Error("usage: tsx generate-third-place-table.ts <wikitext> [out.ts]");
const raw = readFileSync(path, "utf8");

const rows = raw.split(/!\s*scope="row"\s*\|/).slice(1); // drop header/preamble
if (rows.length !== 495) throw new Error(`expected 495 rows, got ${rows.length}`);

const table: Record<string, string> = {};
const errors: string[] = [];
const seenNums = new Set<number>();

rows.forEach((chunk, idx) => {
  const num = +(chunk.match(/^\s*(\d+)\*?/)?.[1] ?? -1);
  if (num !== idx + 1) errors.push(`row ${idx + 1}: number tag is ${num}`);
  if (seenNums.has(num)) errors.push(`duplicate row number ${num}`);
  seenNums.add(num);

  const assign = [...chunk.matchAll(/3([A-L])\b/g)].map((m) => m[1]);
  const bold = [...chunk.matchAll(/'''([A-L])'''/g)].map((m) => m[1]);
  if (assign.length !== 8) {
    errors.push(`row ${num}: ${assign.length} assignment cells (need 8): ${assign.join("")}`);
    return;
  }
  if (bold.length !== 8) errors.push(`row ${num}: ${bold.length} advancing groups (need 8)`);

  const byMatch: Record<number, string> = {};
  assign.forEach((g, i) => (byMatch[WIKI_COL_TO_MATCH[i]] = g));

  if (new Set(assign).size !== 8) errors.push(`row ${num}: assignments not distinct: ${assign.join("")}`);
  for (const [mid, g] of Object.entries(byMatch))
    if (!ALLOWED[+mid].includes(g)) errors.push(`row ${num}: group ${g} illegal for M${mid}`);
  const asgSet = [...assign].sort().join("");
  if (bold.length === 8 && [...bold].sort().join("") !== asgSet)
    errors.push(`row ${num}: advancing != assigned`);

  const value = MATCH_ORDER.map((mid) => byMatch[mid]).join("");
  if (table[asgSet]) errors.push(`row ${num}: duplicate combination ${asgSet}`);
  table[asgSet] = value;
});

// Coverage: all C(12,8) combinations present exactly once.
const combos: string[] = [];
(function pick(start: number, acc: string[]) {
  if (acc.length === 8) return void combos.push(acc.join(""));
  for (let i = start; i < 12; i++) pick(i + 1, [...acc, "ABCDEFGHIJKL"[i]]);
})(0, []);
for (const c of combos) if (!table[c]) errors.push(`missing combination ${c}`);
if (Object.keys(table).length !== 495) errors.push(`table has ${Object.keys(table).length} keys`);

// Independently-confirmed anchor rows (value in match order 74,77,79,80,81,82,85,87).
const ANCHORS: Record<string, string> = {
  BDEFIJKL: "DFEKBIJL", // row 67* — actual WC2026 combo
  EFGHIJKL: "FGEKIHJL", // row 1
  DFGHIJKL: "DFHKIJGL", // row 2
  DEGHIJKL: "DGEKIHJL", // row 3
  DEFGHIJK: "DFEKJHGI", // row 9
  ABDEFIJK: "DFEKBAJI", // row 353
};
for (const [k, v] of Object.entries(ANCHORS))
  if (table[k] !== v) errors.push(`anchor ${k}: got ${table[k]}, want ${v}`);

if (errors.length) {
  console.error(`VALIDATION FAILED (${errors.length}):\n${errors.slice(0, 40).join("\n")}`);
  process.exit(1);
}
console.log(`OK: 495 rows, all legal bijections, full coverage, anchors match.`);

if (out) {
  const entries = Object.keys(table)
    .sort()
    .map((k) => `  ${k}: "${table[k]}",`)
    .join("\n");
  writeFileSync(
    out,
    `// AUTO-GENERATED by scripts/generate-third-place-table.ts — do not edit by hand.
// FIFA World Cup 2026 Annex C third-place placement table (all 495 combinations).
// Source: Wikipedia "Template:2026 FIFA World Cup third-place table" (raw wikitext).
// Validated: every row is a legal bijection into matches 74/77/79/80/81/82/85/87 and
// all C(12,8)=495 group combinations are covered exactly once.
//
// Key   = the 8 qualifying third-place groups, sorted A–L (e.g. "BDEFIJKL").
// Value = the group seated into matches [74,77,79,80,81,82,85,87], in that order
//         (e.g. "DFEKBIJL" => 74←D, 77←F, 79←E, 80←K, 81←B, 82←I, 85←J, 87←L).
export const THIRD_PLACE_MATCH_ORDER = [74, 77, 79, 80, 81, 82, 85, 87] as const;

export const THIRD_PLACE_TABLE: Record<string, string> = {
${entries}
};
`,
  );
  console.log(`wrote ${out} (${Object.keys(table).length} entries)`);
}
