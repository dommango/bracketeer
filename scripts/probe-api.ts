// One-off probe: which API-Football team names DON'T map to our team codes?
// This is the gate for group auto-scoring — every one of the 48 teams must
// resolve to a code, or the answer key would be written wrong.
//
// Run: railway run --service web npx tsx scripts/probe-api.ts

import { TEAMS } from "@/lib/scoring/data";

const BASE = process.env.SPORTS_API_BASE || "https://v3.football.api-sports.io";
const KEY = process.env.SPORTS_API_KEY;

// Known name discrepancies between API-Football and our TEAMS data.
// Maps normalized API name to our team code.
const ALIASES: Record<string, string> = {
  "south korea": "KOR",
  "korea republic": "KOR",
  iran: "IRN",
  "ir iran": "IRN",
  "ivory coast": "CIV",
  "cote d ivoire": "CIV",
  turkey: "TUR",
  turkiye: "TUR",
  "dr congo": "COD",
  "congo dr": "COD",
  "cape verde": "CPV",
  "cabo verde": "CPV",
  "bosnia and herzegovina": "BIH",
  "bosnia herzegovina": "BIH",
  "united states": "USA",
  usa: "USA",
  curacao: "CUW",
};

interface ApiFixture {
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

interface ApiFixturesResponse {
  response?: ApiFixture[];
}

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY ?? "" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function resolveCode(apiName: string, nameToCode: Map<string, string>): string | null {
  const norm = normalize(apiName);
  return nameToCode.get(norm) ?? ALIASES[norm] ?? null;
}

async function main() {
  if (!KEY) {
    console.error("SPORTS_API_KEY not set.");
    process.exit(1);
  }

  // our normalized-name -> code
  const nameToCode = new Map<string, string>();
  for (const [code, name] of Object.entries(TEAMS)) nameToCode.set(normalize(name), code);

  const fx = await get<ApiFixturesResponse>("/fixtures?league=1&season=2026");
  const apiTeams = new Map<number, string>();
  for (const f of fx.response ?? []) {
    apiTeams.set(f.teams.home.id, f.teams.home.name);
    apiTeams.set(f.teams.away.id, f.teams.away.name);
  }

  const unmatched: { id: number; name: string }[] = [];
  let matched = 0;
  for (const [id, name] of apiTeams) {
    if (resolveCode(name, nameToCode)) matched += 1;
    else unmatched.push({ id, name });
  }

  console.log(`API teams: ${apiTeams.size} | matched by name: ${matched} | unmatched: ${unmatched.length}`);
  if (unmatched.length) {
    console.log("\nUNMATCHED (API id | API name) — need an alias:");
    for (const u of unmatched.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${u.id} | "${u.name}"`);
    }
  } else {
    console.log("All 48 teams map cleanly — no aliases needed.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
