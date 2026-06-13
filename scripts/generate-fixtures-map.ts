// Generates content for lib/sports/fixtures-map.ts.
//
// Run:  env $ENV npx tsx scripts/generate-fixtures-map.ts
//
// During the group stage: outputs EXTERNAL_TEAM_CODES (all 48 teams).
// EXTERNAL_TO_MATCHNO is built from knockout fixtures sorted by kickoff time;
// re-run after Jun 26 once groups have resolved (knockout slots are determined).
//
// Review the "FIXTURE MAP DETAIL" section before pasting — verify each
// API fixture's teams match the expected bracket slot shown.

import { TEAMS, GROUPS, R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";

const BASE = process.env.SPORTS_API_BASE || "https://v3.football.api-sports.io";
const KEY = process.env.SPORTS_API_KEY;

// Known name discrepancies between API-Football and our TEAMS data.
// Maps normalized API name → our team code.
const ALIASES: Record<string, string> = {
  "south korea":     "KOR",
  "korea republic":  "KOR",
  "iran":            "IRN",
  "ir iran":         "IRN",
  "ivory coast":     "CIV",
  "cote d ivoire":   "CIV",
  "turkey":          "TUR",
  "turkiye":         "TUR",
  "dr congo":        "COD",
  "congo dr":        "COD",
  "cape verde":      "CPV",
  "cabo verde":      "CPV",
  "cape verde islands": "CPV",
  "bosnia and herzegovina": "BIH",
  "bosnia herzegovina":     "BIH",
  "united states":   "USA",
  "usa":             "USA",
  "curacao":         "CUW",
};

// Round names used by API-Football → our internal match arrays (ordered by match id).
const ROUND_MATCHES: Array<{ apiRound: string; matches: { id: number }[] }> = [
  { apiRound: "Round of 32",    matches: R32 },
  { apiRound: "Round of 16",    matches: R16 },
  { apiRound: "Quarter-finals", matches: QF },
  { apiRound: "Semi-finals",    matches: SF },
  { apiRound: "Final",          matches: [FINAL] },
];

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": KEY ?? "" },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

interface ApiFix {
  fixture: { id: number; date: string };
  league:  { round: string };
  teams:   { home: { id: number; name: string }; away: { id: number; name: string } };
  goals:   { home: number | null; away: number | null };
}

function resolveCode(apiName: string, nameToCode: Map<string, string>): string | null {
  const norm = normalize(apiName);
  return nameToCode.get(norm) ?? ALIASES[norm] ?? null;
}

async function main() {
  if (!KEY) {
    console.error("SPORTS_API_KEY not set — run with env $ENV npx tsx scripts/generate-fixtures-map.ts");
    process.exit(1);
  }

  const json = (await get("/fixtures?league=1&season=2026")) as { response?: ApiFix[] };
  const fixtures: ApiFix[] = json.response ?? [];
  console.error(`Fetched ${fixtures.length} fixtures from API-Football.`);

  // Build name → code lookup from our TEAMS record.
  const nameToCode = new Map<string, string>();
  for (const [code, name] of Object.entries(TEAMS)) nameToCode.set(normalize(name), code);

  // ── STEP 1: EXTERNAL_TEAM_CODES ────────────────────────────────────────────
  const teamCodeMap: Record<string, string> = {};
  const unmatchedTeams: Array<{ id: number; name: string }> = [];

  for (const f of fixtures) {
    for (const side of [f.teams.home, f.teams.away]) {
      if (!side.id || teamCodeMap[side.id]) continue;
      const code = resolveCode(side.name, nameToCode);
      if (code) {
        teamCodeMap[String(side.id)] = code;
      } else if (!unmatchedTeams.find((t) => t.id === side.id)) {
        unmatchedTeams.push({ id: side.id, name: side.name });
      }
    }
  }

  // Validate we have all 48 expected teams.
  const foundCodes = new Set(Object.values(teamCodeMap));
  const missingCodes = Object.keys(TEAMS).filter((c) => !foundCodes.has(c));

  // ── STEP 2: EXTERNAL_TO_MATCHNO ────────────────────────────────────────────
  // Group fixtures by round; sort within each round by kickoff time.
  const byRound = new Map<string, ApiFix[]>();
  for (const f of fixtures) {
    const round = f.league.round;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round)!.push(f);
  }
  for (const arr of byRound.values()) arr.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date));

  const fixtureMatchMap: Record<string, number> = {};
  const fixtureDetail: string[] = [];

  fixtureDetail.push("\n── FIXTURE MAP DETAIL (verify before using) ──");
  fixtureDetail.push("Knockout fixtures sorted by kickoff time, assigned to our match IDs in that order.");
  fixtureDetail.push("⚠  Teams will show as TBD until the group stage resolves (~Jun 26).");

  for (const { apiRound, matches } of ROUND_MATCHES) {
    const apiFixtures = byRound.get(apiRound) ?? [];
    fixtureDetail.push(`\n${apiRound} — ${matches.length} expected, ${apiFixtures.length} found in API`);

    if (apiFixtures.length === 0) {
      fixtureDetail.push("  (no fixtures published yet for this round)");
      continue;
    }

    const maxLen = Math.max(matches.length, apiFixtures.length);
    for (let i = 0; i < maxLen; i++) {
      const our = matches[i];
      const api = apiFixtures[i];
      if (!our || !api) {
        fixtureDetail.push(`  [mismatch: our=${our?.id ?? "—"} api=${api?.fixture.id ?? "—"}]`);
        continue;
      }
      const home = api.teams.home.name || "TBD";
      const away = api.teams.away.name || "TBD";
      fixtureDetail.push(`  M${our.id} ← fixture ${api.fixture.id}  (${api.fixture.date.slice(0, 10)})  ${home} v ${away}`);
      fixtureMatchMap[String(api.fixture.id)] = our.id;
    }
  }

  // ── OUTPUT ─────────────────────────────────────────────────────────────────
  console.log("// ⚠  Auto-generated by scripts/generate-fixtures-map.ts — verify before committing.");
  console.log("// Re-run after groups resolve (~Jun 26) to refresh EXTERNAL_TO_MATCHNO.\n");

  // Team codes
  const teamEntries = Object.entries(teamCodeMap)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id, code]) => `  "${id}": "${code}"`);
  console.log("export const EXTERNAL_TEAM_CODES: Record<string, string> = {");
  console.log(teamEntries.join(",\n"));
  console.log("};\n");

  // Fixture → match number
  const fixtureEntries = Object.entries(fixtureMatchMap)
    .sort(([, a], [, b]) => a - b)
    .map(([fid, matchNo]) => `  "${fid}": ${matchNo}`);
  console.log("export const EXTERNAL_TO_MATCHNO: Record<string, number> = {");
  console.log(fixtureEntries.join(",\n"));
  console.log("};\n");

  // Diagnostics to stderr
  if (unmatchedTeams.length) {
    console.error(`\n⚠  UNMATCHED TEAMS (${unmatchedTeams.length}) — add aliases or manual entries:`);
    for (const t of unmatchedTeams.sort((a, b) => a.name.localeCompare(b.name))) {
      console.error(`  API id ${t.id} | "${t.name}" → normalize: "${normalize(t.name)}"`);
    }
  } else {
    console.error("✓ All API teams matched to a code.");
  }

  if (missingCodes.length) {
    console.error(`\n⚠  MISSING FROM API (${missingCodes.length}) — teams we expect but didn't see in fixtures:`);
    for (const code of missingCodes) console.error(`  ${code} (${TEAMS[code as keyof typeof TEAMS]})`);
  } else {
    console.error("✓ All 48 teams found in API fixtures.");
  }

  const groupsInOurData = Object.keys(GROUPS).length;
  console.error(`\n  Our groups: ${groupsInOurData}  |  Teams mapped: ${foundCodes.size}/48`);
  console.error(`  Knockout fixtures mapped: ${Object.keys(fixtureMatchMap).length}`);

  for (const line of fixtureDetail) console.error(line);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
