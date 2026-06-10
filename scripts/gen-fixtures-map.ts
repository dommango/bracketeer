// Introspect the API-Football (v3) provider and (re)write lib/sports/fixtures-map.ts
// with populated EXTERNAL_TO_MATCHNO + EXTERNAL_TEAM_CODES maps. Provider IDs are
// provider-specific and only available from the API, so they can't be hand-written —
// run this once after setting SPORTS_API_KEY to bridge the IDs to our scoring slots.
//
// Run with: <inline $ENV from CLAUDE.md> SPORTS_API_KEY=... npx tsx scripts/gen-fixtures-map.ts
// Output:   lib/sports/fixtures-map.ts (knockout slots 73–104 + team codes)

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { env, sportsApiEnabled } from "@/lib/env";
import { TEAMS } from "@/lib/scoring/data";
import { R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";

interface ApiFixtureRaw {
  fixture: { id: number; date: string };
  league: { round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
}

const OUT = join(process.cwd(), "lib", "sports", "fixtures-map.ts");

// The header is contractual documentation for the file — preserve it verbatim.
const HEADER = `// Bridge from the sports provider's identifiers to ours. Both maps are
// intentionally EMPTY until the real 2026 draw and fixture list exist — with
// empty maps the poller fetches but applies nothing, so manual entry stays the
// source of truth. Populate these once fixtures are published.
//
// Knockouts: map the SLOT (our internal match number 73–104), not the teams —
// the teams aren't known until the groups resolve. The winner is then derived
// from the live score plus EXTERNAL_TEAM_CODES.`;

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchRawFixtures(): Promise<ApiFixtureRaw[]> {
  const url = `${env.SPORTS_API_BASE}/fixtures?league=1&season=2026`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-apisports-key": env.SPORTS_API_KEY },
      cache: "no-store",
    });
  } catch (cause) {
    throw new Error(`Failed to reach sports API at ${url}: ${(cause as Error).message}`);
  }
  if (!res.ok) throw new Error(`Sports API responded ${res.status} ${res.statusText}`);

  const json = (await res.json()) as { response?: ApiFixtureRaw[] };
  return json.response ?? [];
}

// name -> our code, from TEAMS (which is code -> country name).
function buildNameToCode(): Map<string, string> {
  return Object.entries(TEAMS).reduce(
    (acc, [code, name]) => acc.set(normalizeName(name), code),
    new Map<string, string>(),
  );
}

interface TeamCodeResult {
  codes: Record<string, string>; // providerTeamId -> ourCode
  unmatched: string[];
}

function buildTeamCodes(fixtures: ApiFixtureRaw[]): TeamCodeResult {
  const nameToCode = buildNameToCode();
  // Unique provider teams keyed by id, last write wins (names are stable per id).
  const providers = fixtures.reduce((acc, f) => {
    acc.set(f.teams.home.id, f.teams.home.name);
    acc.set(f.teams.away.id, f.teams.away.name);
    return acc;
  }, new Map<number, string>());

  const codes: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const [id, name] of providers) {
    const code = nameToCode.get(normalizeName(name));
    if (code) codes[String(id)] = code;
    else unmatched.push(name);
  }
  return { codes, unmatched: [...new Set(unmatched)].sort() };
}

// Knockout round buckets, each with our slot ids and the expected fixture count.
const ROUNDS: { label: string; match: (round: string) => boolean; ourIds: number[] }[] = [
  // Order matters: "3rd Place Final" contains "final", so test it before FINAL.
  {
    label: "bronze",
    match: (r) => r.includes("3rd place") || r.includes("third place"),
    ourIds: [BRONZE.id],
  },
  { label: "R32", match: (r) => r.includes("round of 32"), ourIds: R32.map((m) => m.id) },
  { label: "R16", match: (r) => r.includes("round of 16"), ourIds: R16.map((m) => m.id) },
  { label: "QF", match: (r) => r.includes("quarter"), ourIds: QF.map((m) => m.id) },
  { label: "SF", match: (r) => r.includes("semi"), ourIds: SF.map((m) => m.id) },
  { label: "final", match: (r) => r.includes("final"), ourIds: [FINAL.id] },
];

function bucketFor(round: string): (typeof ROUNDS)[number] | undefined {
  const r = round.toLowerCase();
  return ROUNDS.find((b) => b.match(r));
}

// Our slot dates ("Sat Jun 27", no year) parsed into 2026.
const ALL_SLOTS = [...R32, ...R16, ...QF, ...SF, BRONZE, FINAL];
const SLOT_DATE = new Map(ALL_SLOTS.map((m) => [m.id, new Date(`${m.date} 2026`).getTime()]));

interface FixtureMapResult {
  matchNos: Record<string, number>; // providerFixtureId -> matchNo
  perRound: { label: string; mapped: number; expected: number }[];
}

function buildFixtureMap(fixtures: ApiFixtureRaw[]): FixtureMapResult {
  const matchNos: Record<string, number> = {};
  const perRound: FixtureMapResult["perRound"] = [];

  for (const bucket of ROUNDS) {
    const provider = fixtures
      .filter((f) => bucketFor(f.league.round)?.label === bucket.label)
      .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    const ours = [...bucket.ourIds].sort(
      (a, b) => (SLOT_DATE.get(a) ?? 0) - (SLOT_DATE.get(b) ?? 0),
    );

    const expected = bucket.ourIds.length;
    if (provider.length !== expected) {
      console.warn(
        `WARNING: ${bucket.label} expected ${expected} fixtures, got ${provider.length} — mapping the overlap only.`,
      );
    }

    const n = Math.min(provider.length, ours.length);
    for (let i = 0; i < n; i++) matchNos[String(provider[i].fixture.id)] = ours[i];
    perRound.push({ label: bucket.label, mapped: n, expected });
  }

  return { matchNos, perRound };
}

function serialize(matchNos: Record<string, number>, codes: Record<string, string>): string {
  const matchEntries = Object.entries(matchNos)
    .sort((a, b) => a[1] - b[1]) // numeric-ascending by match number
    .map(([id, no]) => `  "${id}": ${no},`)
    .join("\n");
  const codeEntries = Object.entries(codes)
    .sort((a, b) => a[1].localeCompare(b[1])) // by our code
    .map(([id, code]) => `  "${id}": "${code}",`)
    .join("\n");

  return `${HEADER}

// provider fixture id (string) -> internal match number
export const EXTERNAL_TO_MATCHNO: Record<string, number> = {${
    matchEntries ? `\n${matchEntries}\n` : ""
  }};

// provider team id (string) -> our 3-letter team code (e.g. "MEX")
export const EXTERNAL_TEAM_CODES: Record<string, string> = {${
    codeEntries ? `\n${codeEntries}\n` : ""
  }};
`;
}

async function main() {
  if (!sportsApiEnabled) {
    console.error("SPORTS_API_KEY is not set — cannot generate the fixtures map without it.");
    process.exit(1);
  }

  const fixtures = await fetchRawFixtures();
  if (fixtures.length === 0) {
    console.error("Sports API returned no fixtures for league=1 season=2026.");
    process.exit(1);
  }

  const { codes, unmatched } = buildTeamCodes(fixtures);
  const { matchNos, perRound } = buildFixtureMap(fixtures);

  try {
    writeFileSync(OUT, serialize(matchNos, codes), "utf8");
  } catch (cause) {
    throw new Error(`Failed to write ${OUT}: ${(cause as Error).message}`);
  }

  console.log(`Wrote ${OUT}`);
  console.log("Knockout slots mapped per round:");
  for (const r of perRound) console.log(`  ${r.label}: ${r.mapped}/${r.expected}`);
  console.log(`Team codes mapped: ${Object.keys(codes).length}`);
  if (unmatched.length > 0) {
    console.warn(`Unmatched provider team names (${unmatched.length}):`);
    for (const name of unmatched) console.warn(`  - ${name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
