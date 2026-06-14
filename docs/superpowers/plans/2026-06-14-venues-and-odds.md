# Venues & Cities + Live Odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show stadium + host city on every fixture card, and integrate free win-probability odds (The Odds API) with a LIVE-only upset alert and a minimal pick-difficulty readout.

**Architecture:** Venue/city are static, known data keyed by internal `matchNo` (derived from one city token per match so venue/city/accent stay consistent), stored on `Match` and threaded through the existing `MatchInput`/`MatchCenterRow` model. Odds come from The Odds API into a separate 1:1 `MatchOdds` model via a `CRON_SECRET`-guarded poller, with all derivation (implied probability, team-name mapping, matchNo resolution, live-upset) in pure unit-tested helpers.

**Tech Stack:** Next.js 16, Prisma 7 + `@prisma/adapter-pg`, Postgres, Zod, Vitest. Spec: `docs/superpowers/specs/2026-06-14-venues-and-odds-design.md`.

Conventions (from `CLAUDE.md`): inline env prefix for any DB/build command —
```
ENV='DATABASE_URL=postgresql://food_cost_user:food_cost_dev@localhost:5432/bracketeer AUTH_SECRET=dev-only-secret-at-least-32-characters-long CRON_SECRET=dev-cron-secret APP_BASE_URL=http://localhost:3000'
```
Run `env $ENV npx prisma generate` after every schema change (migrate dev's regen is unreliable here). Localhost HTTP is sandboxed — verify UI via `env $ENV npm run build`, backend via tsx scripts. Commit messages: conventional, no attribution footer.

---

### Task 1: Schema — `Match.venue`/`city`, `MatchOdds` model, migration

**Goal:** Add venue/city columns to `Match` and a separate 1:1 `MatchOdds` model, migrate, and regenerate the client.

**Files:**
- Modify: `prisma/schema.prisma` (the `Match` model + new `MatchOdds` model)

**Acceptance Criteria:**
- [ ] `Match` has nullable `venue String?` and `city String?`
- [ ] `Match` has an `odds MatchOdds?` relation
- [ ] `MatchOdds` exists with `matchId @unique`, three `Float` prob fields, `raw Json`, `source String`, `fetchedAt DateTime @updatedAt`
- [ ] Migration applied and Prisma client regenerated; `npm run typecheck` clean

**Verify:** `env $ENV npm run db:migrate -- --name venues_and_odds && env $ENV npx prisma generate && npm run typecheck` → migration applies, generate succeeds, no type errors.

**Steps:**

- [ ] **Step 1: Add venue/city + odds relation to `Match`**

In `prisma/schema.prisma`, inside `model Match { … }`, add alongside the existing scalar fields (e.g. after `scored Boolean @default(false)`):

```prisma
  venue        String?
  city         String?
```

and alongside the existing relations (`result   Result?`, `events …`, `stats MatchStats?`) add:

```prisma
  odds       MatchOdds?
```

- [ ] **Step 2: Add the `MatchOdds` model**

After the `model MatchStats { … }` block, add:

```prisma
model MatchOdds {
  id          String   @id @default(cuid())
  matchId     String   @unique
  match       Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  homeWinProb Float
  drawProb    Float
  awayWinProb Float
  raw         Json     // raw decimal prices, for audit / re-derivation
  source      String   // "the-odds-api"
  fetchedAt   DateTime @updatedAt
}
```

- [ ] **Step 3: Migrate + regenerate**

Run: `env $ENV npm run db:migrate -- --name venues_and_odds`
Then: `env $ENV npx prisma generate`
Expected: migration created/applied; client regenerated under `generated/prisma`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): match venue/city columns + MatchOdds model"
```

---

### Task 2: `MATCH_SCHEDULE` static venue data (TDD)

**Goal:** A pure module mapping each `matchNo` to a host city, with venue/city/accent derived from a stable 16-stadium table.

**Files:**
- Create: `lib/scoring/schedule.ts`
- Test: `lib/scoring/schedule.test.ts`

**Acceptance Criteria:**
- [ ] `HOST_CITIES` defines all 16 host cities, each with `city` (display name) + `venue` (stadium), keyed by a token matching an existing `--city-*` CSS var
- [ ] `MATCH_CITY` maps every `matchNo` 1–104 to a valid city token
- [ ] `venueFor(matchNo)` returns `{ venue, city, cityToken }` or `null`
- [ ] Test asserts: all 16 tokens present; 104 contiguous match entries; every token in `MATCH_CITY` exists in `HOST_CITIES`

**Verify:** `npx vitest run lib/scoring/schedule.test.ts` → PASS.

**Steps:**

- [ ] **Step 1: Write the failing test**

`lib/scoring/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { HOST_CITIES, MATCH_CITY, venueFor } from "./schedule";

const PALETTE_TOKENS = [
  "atlanta", "boston", "dallas", "guadalajara", "houston", "kansas-city",
  "los-angeles", "mexico-city", "miami", "monterrey", "new-york-nj",
  "philadelphia", "san-francisco", "seattle", "toronto", "vancouver",
];

describe("schedule", () => {
  it("defines all 16 host cities with matching palette tokens", () => {
    expect(Object.keys(HOST_CITIES).sort()).toEqual([...PALETTE_TOKENS].sort());
    for (const c of Object.values(HOST_CITIES)) {
      expect(c.city.length).toBeGreaterThan(0);
      expect(c.venue.length).toBeGreaterThan(0);
    }
  });

  it("maps every match 1–104 to a known city token", () => {
    for (let n = 1; n <= 104; n++) {
      const token = MATCH_CITY[n];
      expect(token, `match ${n} missing`).toBeTruthy();
      expect(HOST_CITIES[token], `match ${n} token ${token} not in HOST_CITIES`).toBeTruthy();
    }
    expect(Object.keys(MATCH_CITY)).toHaveLength(104);
  });

  it("venueFor returns derived venue/city or null", () => {
    const v = venueFor(104);
    expect(v).not.toBeNull();
    expect(v!.cityToken in HOST_CITIES).toBe(true);
    expect(venueFor(999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scoring/schedule.test.ts`
Expected: FAIL — `Cannot find module './schedule'`.

- [ ] **Step 3: Write the implementation**

`lib/scoring/schedule.ts`. The `HOST_CITIES` table is stable, known data — fill it verbatim. The `MATCH_CITY` map must be sourced from the **official FIFA WC2026 match schedule** (each match number's host city); populate all 104 from the official schedule (see Step 4 verification).

```ts
// Static venue data for WC2026. Venues are fixed and public, so this is a
// dependency-free source of truth keyed by internal matchNo. Each match maps to
// one host-city token; venue/city/accent all derive from HOST_CITIES so they
// stay consistent. Tokens match the --city-* palette in app/globals.css.

export interface HostCity {
  city: string; // display name
  venue: string; // stadium name
}

export type CityToken =
  | "atlanta" | "boston" | "dallas" | "guadalajara" | "houston" | "kansas-city"
  | "los-angeles" | "mexico-city" | "miami" | "monterrey" | "new-york-nj"
  | "philadelphia" | "san-francisco" | "seattle" | "toronto" | "vancouver";

export const HOST_CITIES: Record<CityToken, HostCity> = {
  "atlanta":       { city: "Atlanta",            venue: "Mercedes-Benz Stadium" },
  "boston":        { city: "Boston",             venue: "Gillette Stadium" },
  "dallas":        { city: "Dallas",             venue: "AT&T Stadium" },
  "guadalajara":   { city: "Guadalajara",        venue: "Estadio Akron" },
  "houston":       { city: "Houston",            venue: "NRG Stadium" },
  "kansas-city":   { city: "Kansas City",        venue: "Arrowhead Stadium" },
  "los-angeles":   { city: "Los Angeles",        venue: "SoFi Stadium" },
  "mexico-city":   { city: "Mexico City",        venue: "Estadio Azteca" },
  "miami":         { city: "Miami",              venue: "Hard Rock Stadium" },
  "monterrey":     { city: "Monterrey",          venue: "Estadio BBVA" },
  "new-york-nj":   { city: "New York / New Jersey", venue: "MetLife Stadium" },
  "philadelphia":  { city: "Philadelphia",       venue: "Lincoln Financial Field" },
  "san-francisco": { city: "San Francisco Bay Area", venue: "Levi's Stadium" },
  "seattle":       { city: "Seattle",            venue: "Lumen Field" },
  "toronto":       { city: "Toronto",            venue: "BMO Field" },
  "vancouver":     { city: "Vancouver",          venue: "BC Place" },
};

// matchNo (1–104) -> host-city token. Sourced from the official WC2026 schedule.
// NOTE: our internal group matchNo ordering is groupMatchups order (groups A–L,
// 6 each = 1–72), which is NOT FIFA's chronological numbering — map by fixture,
// then verify with scripts/verify-venues.ts before committing.
export const MATCH_CITY: Record<number, CityToken> = {
  // 1: "mexico-city", 2: "...", … all 104 entries from the official schedule
};

export function venueFor(
  matchNo: number,
): { venue: string; city: string; cityToken: CityToken } | null {
  const token = MATCH_CITY[matchNo];
  if (!token) return null;
  const c = HOST_CITIES[token];
  return { venue: c.venue, city: c.city, cityToken: token };
}
```

- [ ] **Step 4: Populate `MATCH_CITY` from the official schedule, then run the test**

Fill all 104 entries from the official FIFA WC2026 match list (match number → host city). Run: `npx vitest run lib/scoring/schedule.test.ts`
Expected: PASS (coverage + token validity enforced).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/schedule.ts lib/scoring/schedule.test.ts
git commit -m "feat(scoring): static WC2026 venue/city schedule data"
```

---

### Task 3: Seed venue/city + verify script

**Goal:** Write venue/city into `Match` rows on seed, and add a verification script that prints/asserts coverage.

**Files:**
- Modify: `prisma/seed.ts`
- Create: `scripts/verify-venues.ts`

**Acceptance Criteria:**
- [ ] Seed upsert sets `venue`/`city` from `venueFor(matchNo)` in both `create` and `update`
- [ ] `scripts/verify-venues.ts` prints `matchNo → home/away (or slot) → venue · city` and reports any match missing venue/city
- [ ] Re-seeding is idempotent and populates venue/city for all 104 matches

**Verify:** `env $ENV npx tsx prisma/seed.ts && env $ENV npx tsx scripts/verify-venues.ts` → seed reports 104 matches; verify reports 0 missing.

**Steps:**

- [ ] **Step 1: Wire `venueFor` into the seed upsert**

In `prisma/seed.ts`, import at top with the other `lib/scoring/data` imports:

```ts
import { venueFor } from "../lib/scoring/schedule";
```

In the match loop (`for (const sm of matches) { await prisma.match.upsert({ … }) }`), compute once and add the fields to **both** `update` and `create`:

```ts
  for (const sm of matches) {
    const v = venueFor(sm.matchNo);
    await prisma.match.upsert({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: sm.matchNo } },
      update: {
        roundCode: sm.roundCode,
        homeSlotRef: sm.homeSlotRef,
        awaySlotRef: sm.awaySlotRef,
        scheduledAt: sm.date ? parseLabelDate(sm.date) : null,
        venue: v?.venue ?? null,
        city: v?.city ?? null,
      },
      create: {
        tournamentId: tournament.id,
        matchNo: sm.matchNo,
        roundCode: sm.roundCode,
        homeSlotRef: sm.homeSlotRef,
        awaySlotRef: sm.awaySlotRef,
        scheduledAt: sm.date ? parseLabelDate(sm.date) : null,
        venue: v?.venue ?? null,
        city: v?.city ?? null,
      },
    });
  }
```

- [ ] **Step 2: Write the verify script**

`scripts/verify-venues.ts`:

```ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const t = await prisma.tournament.findUnique({ where: { slug: "wc2026" }, select: { id: true } });
  if (!t) throw new Error("wc2026 not seeded");
  const matches = await prisma.match.findMany({
    where: { tournamentId: t.id },
    orderBy: { matchNo: "asc" },
    select: { matchNo: true, roundCode: true, homeSlotRef: true, awaySlotRef: true, venue: true, city: true },
  });
  let missing = 0;
  for (const m of matches) {
    const tag = m.venue && m.city ? `${m.venue} · ${m.city}` : "*** MISSING ***";
    if (!m.venue || !m.city) missing++;
    console.log(`#${String(m.matchNo).padStart(3)} ${m.roundCode.padEnd(6)} ${m.homeSlotRef} v ${m.awaySlotRef}  →  ${tag}`);
  }
  console.log(`\n${matches.length} matches, ${missing} missing venue/city`);
  if (missing > 0) process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 3: Run seed + verify**

Run: `env $ENV npx tsx prisma/seed.ts`
Then: `env $ENV npx tsx scripts/verify-venues.ts`
Expected: `104 matches, 0 missing venue/city`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts scripts/verify-venues.ts
git commit -m "feat(seed): populate match venue/city; add verify-venues script"
```

---

### Task 4: Thread venue/city through the match model + selectors (TDD)

**Goal:** Carry `venue`/`city` from the DB through the pure `MatchInput`/`MatchCenterRow` model and `MatchDetail`, so views can render them.

**Files:**
- Modify: `lib/pool/match-center.ts` (`MatchInput`, `MatchCenterRow`, `buildRow`)
- Test: `lib/pool/match-center.test.ts`
- Modify: `lib/pool/queries.ts` (`toMatchInput`, `getMatchCenter` select, `getLastMatch` select, `getMatchDetail` select + return, `MatchDetail` interface)

**Acceptance Criteria:**
- [ ] `MatchInput` and `MatchCenterRow` carry `venue: string | null` and `city: string | null`
- [ ] `buildRow` passes venue/city straight through
- [ ] `MatchDetail` carries `venue`/`city`
- [ ] All selectors (`getMatchCenter`, `getLastMatch`, `getMatchDetail`) select `venue`/`city` and populate them
- [ ] `npx vitest run lib/pool/match-center.test.ts` PASS; `npm run typecheck` clean

**Verify:** `npx vitest run lib/pool/match-center.test.ts && npm run typecheck` → PASS.

**Steps:**

- [ ] **Step 1: Add a failing test for pass-through**

Append to `lib/pool/match-center.test.ts` (use the file's existing helper for building a `MatchInput`; if it builds inline objects, mirror that shape and add `venue`/`city`):

```ts
import { buildMatchCenter } from "./match-center";

it("carries venue and city onto the row", () => {
  const sections = buildMatchCenter([
    {
      matchNo: 1, roundCode: "GROUP", scheduledAt: null,
      homeCode: "MEX", awayCode: "BRA",
      homeScore: null, awayScore: null, winnerCode: null, resultStatus: null,
      venue: "Estadio Azteca", city: "Mexico City",
    },
  ]);
  const row = sections[0].matches[0];
  expect(row.venue).toBe("Estadio Azteca");
  expect(row.city).toBe("Mexico City");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pool/match-center.test.ts`
Expected: FAIL — `venue` not on the row type / undefined.

- [ ] **Step 3: Add fields to the model + `buildRow`**

In `lib/pool/match-center.ts`:

Add to `interface MatchInput` (after `awayRef?`):
```ts
  venue?: string | null;
  city?: string | null;
```

Add to `interface MatchCenterRow` (after `yourPick`):
```ts
  venue: string | null;
  city: string | null;
```

In `buildRow`, add to the returned object (after `yourPick,`):
```ts
    venue: m.venue ?? null,
    city: m.city ?? null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pool/match-center.test.ts`
Expected: PASS.

- [ ] **Step 5: Select + populate venue/city in the query layer**

In `lib/pool/queries.ts`:

In `toMatchInput` add to the returned object (after `awayRef: m.awaySlotRef,`):
```ts
    venue: m.venue ?? null,
    city: m.city ?? null,
```
(This requires `ResolvableMatch`/the select to include `venue`/`city`.)

In the `getMatchCenter` `prisma.match.findMany` select, add `venue: true,` and `city: true,` next to `scheduledAt: true,`. Do the same in `getLastMatch`'s select and any other select feeding `toMatchInput` (search the file for `homeSlotRef: true` to find them — the `ResolvableMatch` selects).

In `getMatchDetail`'s `prisma.match.findUnique` select, add `venue: true,` and `city: true,`. Add to `interface MatchDetail` (after `roundLabel: string;`):
```ts
  venue: string | null;
  city: string | null;
```
And to the returned object (after `roundLabel: roundLabel(match.roundCode),`):
```ts
    venue: match.venue ?? null,
    city: match.city ?? null,
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/pool/match-center.ts lib/pool/match-center.test.ts lib/pool/queries.ts
git commit -m "feat(matches): thread venue/city through match model and selectors"
```

---

### Task 5: Venue/city UI on fixture cards + match detail

**Goal:** Render "Venue · City" with the host-city accent on fixture cards and the match-detail header.

**Files:**
- Modify: `app/pool/[code]/MatchCenter.tsx`
- Modify: `app/pool/[code]/ScoreCards.tsx`
- Modify: `app/pool/[code]/LiveNow.tsx`
- Modify: `app/pool/[code]/matches/[no]/page.tsx`
- Create: `app/pool/[code]/VenueLine.tsx`

**Acceptance Criteria:**
- [ ] A shared `VenueLine` component renders `venue · city` accented by the city token, and renders nothing when venue/city are null
- [ ] `MatchCenter` fixture rows show the venue line
- [ ] `ScoreCards` and `LiveNow` cards show the venue line (where they render a match)
- [ ] Match-detail header shows the venue/city
- [ ] `env $ENV npm run build` succeeds

**Verify:** `env $ENV npm run build` → compiles all routes with no errors.

**Steps:**

- [ ] **Step 1: Create the shared `VenueLine` component**

`app/pool/[code]/VenueLine.tsx`. It maps the city display name back to its token for the accent. To avoid a second lookup, accept an optional `cityToken`; if absent, slugify the city name (lowercase, spaces→`-`, drop `/`):

```tsx
// Renders "Venue · City" with the host-city accent. No-ops when data is absent.
function tokenFor(city: string): string {
  return city.toLowerCase().replace(/\s*\/\s*/g, "-").replace(/\s+/g, "-");
}

export function VenueLine({ venue, city }: { venue: string | null; city: string | null }) {
  if (!venue || !city) return null;
  const token = tokenFor(city);
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--city-${token})` }}
        aria-hidden
      />
      <span className="truncate">
        {venue} <span className="text-ink-4">· {city}</span>
      </span>
    </div>
  );
}
```

Note: `tokenFor("New York / New Jersey")` → `new-york-nj`; `"San Francisco Bay Area"` → `san-francisco-bay-area`. The latter has no palette var, so add aliases — simplest is to keep the slug for the 14 simple cities and special-case the two compound names:

```tsx
const TOKEN_OVERRIDES: Record<string, string> = {
  "New York / New Jersey": "new-york-nj",
  "San Francisco Bay Area": "san-francisco",
};
function tokenFor(city: string): string {
  return TOKEN_OVERRIDES[city] ?? city.toLowerCase().replace(/\s+/g, "-");
}
```

- [ ] **Step 2: Add the venue line to `MatchCenter` rows**

In `app/pool/[code]/MatchCenter.tsx`, import it (`import { VenueLine } from "./VenueLine";`) and render it inside `MatchRow`, after the away `Side`/your-pick block, near the bottom of the card `<Link>`:

```tsx
      <div className="mt-1.5"><VenueLine venue={row.venue} city={row.city} /></div>
```

- [ ] **Step 3: Add the venue line to `ScoreCards` and `LiveNow`**

In each, import `VenueLine` and render `<VenueLine venue={row.venue} city={row.city} />` within the card body where the match teams/score are shown (these consume `MatchCenterRow`, which now carries venue/city). Place it under the score line, matching each card's spacing.

- [ ] **Step 4: Add venue/city to the match-detail header**

In `app/pool/[code]/matches/[no]/page.tsx`, import `VenueLine` (`import { VenueLine } from "../../VenueLine";`) and render it near the round label / kickoff header:

```tsx
<VenueLine venue={match.venue} city={match.city} />
```
(`match` is the `MatchDetail`; it now carries `venue`/`city`.)

- [ ] **Step 5: Build**

Run: `env $ENV npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/pool/\[code\]/VenueLine.tsx app/pool/\[code\]/MatchCenter.tsx app/pool/\[code\]/ScoreCards.tsx app/pool/\[code\]/LiveNow.tsx app/pool/\[code\]/matches/\[no\]/page.tsx
git commit -m "feat(ui): venue/city line on fixture cards and match detail"
```

---

### Task 6: Odds env config + client

**Goal:** Add graceful-degrading `ODDS_API_KEY` config and a thin fetch client for The Odds API.

**Files:**
- Modify: `lib/env.ts`
- Create: `lib/odds/client.ts`

**Acceptance Criteria:**
- [ ] `env` validates optional `ODDS_API_KEY` (default `""`) and `ODDS_API_BASE` (default the v4 base)
- [ ] `oddsApiEnabled` boolean exported (true only when key set)
- [ ] `fetchOddsEvents()` returns a typed list `{ homeName, awayName, commenceTime, decimalHome, decimalDraw, decimalAway }`, requesting `markets=h2h` + a single region
- [ ] `npm run typecheck` clean

**Verify:** `npm run typecheck` → PASS.

**Steps:**

- [ ] **Step 1: Extend env**

In `lib/env.ts` `schema`, after the sports keys:

```ts
  // Betting odds (The Odds API — optional; win-prob UI disables cleanly without it).
  ODDS_API_KEY: z.string().default(""),
  ODDS_API_BASE: z.string().default("https://api.the-odds-api.com/v4"),
  ODDS_API_REGION: z.string().default("eu"),
```

After `export const sportsApiEnabled = …`:

```ts
export const oddsApiEnabled = Boolean(env.ODDS_API_KEY);
```

- [ ] **Step 2: Write the client**

`lib/odds/client.ts`:

```ts
// The Odds API (v4) client. soccer_fifa_world_cup, h2h market, one region =
// 1 credit/call (500/mo free). One call returns the whole upcoming slate.
// Only used when ODDS_API_KEY is set; the poller short-circuits otherwise.

import { env } from "@/lib/env";

export interface OddsEvent {
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
  decimalHome: number;
  decimalDraw: number;
  decimalAway: number;
}

interface ApiOutcome { name: string; price: number }
interface ApiMarket { key: string; outcomes: ApiOutcome[] }
interface ApiBookmaker { markets: ApiMarket[] }
interface ApiEvent {
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: ApiBookmaker[];
}

// Pull the first bookmaker's h2h prices; map the three outcomes to home/draw/away
// by name ("Draw" is literal; the other two match home_team/away_team).
export function parseOddsEvents(raw: ApiEvent[]): OddsEvent[] {
  const out: OddsEvent[] = [];
  for (const ev of raw) {
    const h2h = ev.bookmakers?.[0]?.markets?.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const priceOf = (name: string) => h2h.outcomes.find((o) => o.name === name)?.price;
    const dh = priceOf(ev.home_team);
    const da = priceOf(ev.away_team);
    const dd = priceOf("Draw");
    if (dh == null || da == null || dd == null) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      decimalHome: dh,
      decimalDraw: dd,
      decimalAway: da,
    });
  }
  return out;
}

export async function fetchOddsEvents(signal?: AbortSignal): Promise<OddsEvent[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API responded ${res.status}`);
  const json = (await res.json()) as ApiEvent[];
  return parseOddsEvents(json);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts lib/odds/client.ts
git commit -m "feat(odds): env config + The Odds API client"
```

---

### Task 7: Odds mapping helpers (pure, TDD)

**Goal:** Pure, fully-tested helpers for team-name normalization, matchNo resolution, implied-probability conversion, and live-upset detection.

**Files:**
- Create: `lib/odds/map.ts`
- Test: `lib/odds/map.test.ts`

**Acceptance Criteria:**
- [ ] `toImpliedProbs(dH, dD, dA)` returns normalized probs summing to ~1 (overround stripped)
- [ ] `normalizeTeam(name)` resolves every team's canonical `TEAMS` name and the seeded aliases to a code; unknown → `null`
- [ ] `resolveMatchNo(home, away, matches)` matches on the unordered code pair; unknown/ambiguous → `null`
- [ ] `liveUpset({status, home, away, winnerless}, probs)` is true only when LIVE and the team currently ahead had the lower implied win prob
- [ ] `npx vitest run lib/odds/map.test.ts` PASS

**Verify:** `npx vitest run lib/odds/map.test.ts` → PASS.

**Steps:**

- [ ] **Step 1: Write the failing tests**

`lib/odds/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toImpliedProbs, normalizeTeam, resolveMatchNo, liveUpset } from "./map";

describe("toImpliedProbs", () => {
  it("normalizes to sum 1 and strips overround", () => {
    const p = toImpliedProbs(2.0, 3.5, 4.0); // raw 0.5+0.286+0.25 = 1.036
    const sum = p.homeWinProb + p.drawProb + p.awayWinProb;
    expect(sum).toBeCloseTo(1, 5);
    expect(p.homeWinProb).toBeGreaterThan(p.awayWinProb);
  });
});

describe("normalizeTeam", () => {
  it("resolves canonical names and aliases", () => {
    expect(normalizeTeam("Mexico")).toBe("MEX");
    expect(normalizeTeam("South Korea")).toBe("KOR");
    expect(normalizeTeam("United States")).toBe("USA");
    expect(normalizeTeam("Ivory Coast")).toBe("CIV");
  });
  it("returns null for unknown", () => {
    expect(normalizeTeam("Atlantis")).toBeNull();
  });
});

describe("resolveMatchNo", () => {
  const matches = [
    { matchNo: 1, homeCode: "MEX", awayCode: "BRA" },
    { matchNo: 2, homeCode: "USA", awayCode: "ENG" },
  ];
  it("matches the unordered code pair", () => {
    expect(resolveMatchNo("BRA", "MEX", matches)).toBe(1);
    expect(resolveMatchNo("USA", "ENG", matches)).toBe(2);
  });
  it("returns null when no pair matches", () => {
    expect(resolveMatchNo("MEX", "USA", matches)).toBeNull();
  });
});

describe("liveUpset", () => {
  const probs = { homeWinProb: 0.7, drawProb: 0.2, awayWinProb: 0.1 }; // home favored
  it("true when LIVE and the underdog leads", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 0, awayScore: 1 }, probs)).toBe(true);
  });
  it("false when the favorite leads", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 1, awayScore: 0 }, probs)).toBe(false);
  });
  it("false when tied or not live", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 1, awayScore: 1 }, probs)).toBe(false);
    expect(liveUpset({ status: "FINAL", homeScore: 0, awayScore: 1 }, probs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/odds/map.test.ts`
Expected: FAIL — `Cannot find module './map'`.

- [ ] **Step 3: Implement the helpers**

`lib/odds/map.ts`:

```ts
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
  "Cape Verde": "CPV",
  "Cabo Verde": "CPV",
  "Curacao": "CUW",
  "Curaçao": "CUW",
  "South Africa": "RSA",
  "Saudi Arabia": "KSA",
  "New Zealand": "NZL",
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/odds/map.test.ts`
Expected: PASS. If `normalizeTeam("Mexico")` fails, confirm `TEAMS["MEX"] === "Mexico"` in `lib/scoring/data.ts` and adjust the alias table for any names that differ.

- [ ] **Step 5: Commit**

```bash
git add lib/odds/map.ts lib/odds/map.test.ts
git commit -m "feat(odds): pure mapping/probability/upset helpers"
```

---

### Task 8: Odds poller + cron route + verify script

**Goal:** Fetch odds, map to matchNos, upsert `MatchOdds`; expose a `CRON_SECRET`-guarded route; register the cron ping; add a verify script.

**Files:**
- Create: `lib/odds/poll.ts`
- Create: `app/api/cron/poll-odds/route.ts`
- Create: `scripts/verify-odds.ts`
- Modify: `scripts/cron.mjs`

**Acceptance Criteria:**
- [ ] `pollOdds()` no-ops (returns a zero summary) when `oddsApiEnabled` is false
- [ ] When enabled: fetches events, normalizes both teams, resolves matchNo against current matches (group teams from slot ref / result; knockout teams from resolved bracket / result), computes implied probs, upserts `MatchOdds`, returns `{ fetched, mapped, upserted, unmatched }`
- [ ] `/api/cron/poll-odds` requires the `x-cron-secret` header (constant-time), returns the summary
- [ ] `scripts/cron.mjs` also pings `/api/cron/poll-odds`
- [ ] `scripts/verify-odds.ts` prints mapped matchNos + probs and lists unmatched event names
- [ ] `npm run typecheck` + `env $ENV npm run build` succeed

**Verify:** `npm run typecheck && env $ENV npm run build && env $ENV npx tsx scripts/verify-odds.ts` → typecheck/build pass; verify runs (no-op summary when `ODDS_API_KEY` unset).

**Steps:**

- [ ] **Step 1: Write the poller**

`lib/odds/poll.ts`. Reuse the same team-resolution approach as `toMatchInput` (group teams from `homeSlotRef`/`awaySlotRef` or the live `Result`; knockout teams from `resolveBracket(officialResults)` or the `Result`). Build a `CodedMatch[]` for the current tournament, then map events.

```ts
import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchOddsEvents } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toImpliedProbs, type CodedMatch } from "@/lib/odds/map";
import { resolveBracket } from "@/lib/pool/bracket";
import { asResults } from "@/lib/pool/queries"; // if not exported, inline the same cast used there

export interface OddsPollSummary {
  fetched: number; mapped: number; upserted: number; unmatched: string[];
}

export async function pollOdds(): Promise<OddsPollSummary> {
  if (!oddsApiEnabled) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const resolved = resolveBracket(asResults(tournament.officialResults));
  const rows = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true, matchNo: true, roundCode: true, homeSlotRef: true, awaySlotRef: true,
      result: { select: { homeTeamCode: true, awayTeamCode: true } },
    },
  });

  const idByMatchNo = new Map<number, string>();
  const coded: CodedMatch[] = rows.map((m) => {
    idByMatchNo.set(m.matchNo, m.id);
    const isGroup = m.roundCode === "GROUP";
    const r = resolved[m.matchNo];
    const homeCode = isGroup ? (m.result?.homeTeamCode ?? m.homeSlotRef) : (m.result?.homeTeamCode ?? r?.home ?? null);
    const awayCode = isGroup ? (m.result?.awayTeamCode ?? m.awaySlotRef) : (m.result?.awayTeamCode ?? r?.away ?? null);
    return { matchNo: m.matchNo, homeCode, awayCode };
  });

  const events = await fetchOddsEvents();
  let mapped = 0, upserted = 0;
  const unmatched: string[] = [];

  for (const ev of events) {
    const home = normalizeTeam(ev.homeName);
    const away = normalizeTeam(ev.awayName);
    if (!home || !away) { unmatched.push(`${ev.homeName} v ${ev.awayName}`); continue; }
    const matchNo = resolveMatchNo(home, away, coded);
    if (matchNo == null) { unmatched.push(`${home} v ${away}`); continue; }
    mapped++;
    const probs = toImpliedProbs(ev.decimalHome, ev.decimalDraw, ev.decimalAway);
    const matchId = idByMatchNo.get(matchNo)!;
    await prisma.matchOdds.upsert({
      where: { matchId },
      update: { ...probs, raw: ev as object, source: "the-odds-api" },
      create: { matchId, ...probs, raw: ev as object, source: "the-odds-api" },
    });
    upserted++;
  }

  return { fetched: events.length, mapped, upserted, unmatched };
}
```

If `asResults` is not exported from `queries.ts`, export it (it's a small cast helper) or replicate the same one-line cast used there. Confirm `lib/db.ts` exports `prisma`.

- [ ] **Step 2: Write the cron route**

`app/api/cron/poll-odds/route.ts` (mirror `poll-scores/route.ts` exactly):

```ts
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollOdds } from "@/lib/odds/poll";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

function secretMatches(provided: string | null): boolean {
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-cron-secret"))) return apiError("unauthorized", 401);
  try {
    return apiOk(await pollOdds());
  } catch (err) {
    console.error("poll-odds failed:", err);
    return apiError(`odds poll failed: ${(err as Error).message}`, 502);
  }
}
```

- [ ] **Step 3: Register the cron ping**

In `scripts/cron.mjs`, after the existing `poll-scores` fetch + log (before `process.exit`), add a second ping so the one cron service refreshes both. Replace the tail of the file:

```js
const score = await fetch(`${base}/api/cron/poll-scores`, { method: "POST", headers: { "x-cron-secret": secret } });
console.log(`cron poll-scores ${score.status}: ${await score.text()}`);

const odds = await fetch(`${base}/api/cron/poll-odds`, { method: "POST", headers: { "x-cron-secret": secret } });
console.log(`cron poll-odds ${odds.status}: ${await odds.text()}`);

process.exit(score.ok ? 0 : 1);
```

- [ ] **Step 4: Write the verify script**

`scripts/verify-odds.ts`:

```ts
import { pollOdds } from "../lib/odds/poll";

async function main() {
  const summary = await pollOdds();
  console.log("odds poll summary:", JSON.stringify(summary, null, 2));
  if (summary.unmatched.length) {
    console.log("\nUNMATCHED EVENTS (add aliases in lib/odds/map.ts):");
    for (const u of summary.unmatched) console.log("  -", u);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Typecheck, build, verify**

Run: `npm run typecheck`
Then: `env $ENV npm run build`
Then: `env $ENV npx tsx scripts/verify-odds.ts`
Expected: typecheck + build pass; verify prints a zero summary when `ODDS_API_KEY` is unset (and, with a real key, prints mapped counts + any unmatched names).

- [ ] **Step 6: Commit**

```bash
git add lib/odds/poll.ts app/api/cron/poll-odds/route.ts scripts/verify-odds.ts scripts/cron.mjs
git commit -m "feat(odds): poller, cron route, cron ping, verify script"
```

---

### Task 9: Win-probability + upset + pick-difficulty UI

**Goal:** Surface odds in the row/detail selectors and render a win-prob bar (cards + detail), a LIVE-only upset badge, and a pick-difficulty label (match detail only).

**Files:**
- Modify: `lib/pool/match-center.ts` (`MatchInput`, `MatchCenterRow` odds fields)
- Modify: `lib/pool/queries.ts` (`toMatchInput`, selects, `getMatchDetail` + `MatchDetail`)
- Create: `app/pool/[code]/WinProbBar.tsx`
- Modify: `app/pool/[code]/MatchCenter.tsx` (bar + upset badge)
- Modify: `app/pool/[code]/matches/[no]/page.tsx` (bar + upset badge + pick-difficulty)

**Acceptance Criteria:**
- [ ] `MatchCenterRow` and `MatchDetail` carry an optional `odds: { homeWinProb; drawProb; awayWinProb } | null`
- [ ] Selectors include the `odds` relation and populate the three probs
- [ ] `WinProbBar` renders an H/D/A split (percent labels) when odds exist, nothing otherwise
- [ ] LIVE rows with an upset (via `liveUpset`) show a "⚡ Upset" badge; never when SCHEDULED/FINAL/tied
- [ ] Match detail shows the bar, the LIVE upset badge, and — for a scored knockout with a your-pick — "you backed an N% pick"
- [ ] `npm run typecheck` + `env $ENV npm run build` succeed

**Verify:** `npm run typecheck && env $ENV npm run build` → PASS.

**Steps:**

- [ ] **Step 1: Add odds to the pure row model**

In `lib/pool/match-center.ts`:

Add to `interface MatchInput`:
```ts
  odds?: { homeWinProb: number; drawProb: number; awayWinProb: number } | null;
```
Add to `interface MatchCenterRow`:
```ts
  odds: { homeWinProb: number; drawProb: number; awayWinProb: number } | null;
```
In `buildRow` returned object:
```ts
    odds: m.odds ?? null,
```

- [ ] **Step 2: Populate odds in the selectors**

In `lib/pool/queries.ts`:

Add `odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },` to the `select` in `getMatchCenter`, `getLastMatch` (and any other `ResolvableMatch` select feeding `toMatchInput`), and `getMatchDetail`.

In `toMatchInput` returned object:
```ts
    odds: m.odds ?? null,
```

In `getMatchDetail`: add to `interface MatchDetail`:
```ts
  odds: { homeWinProb: number; drawProb: number; awayWinProb: number } | null;
```
and to the returned object:
```ts
    odds: match.odds ?? null,
```

- [ ] **Step 3: Create `WinProbBar`**

`app/pool/[code]/WinProbBar.tsx`:

```tsx
type Probs = { homeWinProb: number; drawProb: number; awayWinProb: number };
const pct = (x: number) => Math.round(x * 100);

export function WinProbBar({ odds }: { odds: Probs | null }) {
  if (!odds) return null;
  const h = pct(odds.homeWinProb), d = pct(odds.drawProb), a = pct(odds.awayWinProb);
  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        <span style={{ width: `${h}%`, background: "var(--pitch)" }} />
        <span style={{ width: `${d}%`, background: "var(--ink-4)" }} />
        <span style={{ width: `${a}%`, background: "var(--round-r16)" }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] font-mono text-ink-3">
        <span>{h}%</span><span>D {d}%</span><span>{a}%</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Upset badge helper for the client**

The client can't import the server-side `liveUpset` freely, but `lib/odds/map.ts` is pure — import it in both server and client components. Add an `UpsetBadge` near the top of `MatchCenter.tsx`:

```tsx
import { liveUpset } from "@/lib/odds/map";

function UpsetBadge({ row }: { row: MatchCenterRow }) {
  if (!row.odds) return null;
  const ahead =
    row.status === "LIVE" &&
    liveUpset({ status: row.status, homeScore: row.home.score, awayScore: row.away.score }, row.odds);
  if (!ahead) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      ⚡ Upset
    </span>
  );
}
```

- [ ] **Step 5: Render bar + badge in `MatchCenter` rows**

In `MatchRow`, add `<UpsetBadge row={row} />` into the top status row (next to `<StatusBadge … />`), and `<WinProbBar odds={row.odds} />` near the venue line. Import `WinProbBar`.

- [ ] **Step 6: Match-detail bar + badge + pick-difficulty**

In `app/pool/[code]/matches/[no]/page.tsx`, import `WinProbBar` and `liveUpset`. Render `<WinProbBar odds={match.odds} />` under the team rows. Show the LIVE upset badge using the same logic. For pick difficulty, when `match.scored && match.yourPick && match.odds`, compute the implied prob of the picked side:

```tsx
{match.scored && match.yourPick && match.odds ? (() => {
  const code = match.yourPick.code;
  const p = code === match.home.code ? match.odds.homeWinProb
          : code === match.away.code ? match.odds.awayWinProb : null;
  return p != null ? (
    <p className="mt-1 text-xs text-ink-3">You backed a {Math.round(p * 100)}% pick</p>
  ) : null;
})() : null}
```

- [ ] **Step 7: Typecheck + build**

Run: `npm run typecheck`
Then: `env $ENV npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/pool/match-center.ts lib/pool/queries.ts app/pool/\[code\]/WinProbBar.tsx app/pool/\[code\]/MatchCenter.tsx app/pool/\[code\]/matches/\[no\]/page.tsx
git commit -m "feat(odds): win-prob bar, live upset badge, pick-difficulty"
```

---

## Self-Review

**Spec coverage:**
- Venue/city schema + static data + seed + plumbing + UI → Tasks 1–5. ✓
- Odds env, client, mapping, MatchOdds model, poller/cron, display (win-prob bar, LIVE-only upset, pick-difficulty on match detail) → Tasks 1, 6–9. ✓
- LIVE-only upset (never post-match) → `liveUpset` returns false unless `status==="LIVE"` (Task 7) and the UI re-checks status (Task 9). ✓
- Separate `MatchOdds` 1:1 model → Task 1. ✓
- "Keep it simple": pick-difficulty only on match detail → Task 9 (no profile changes). ✓
- TDD on all pure logic (schedule, map, model pass-through) → Tasks 2, 4, 7. ✓
- Deferred (genius/upset points, profile difficulty, Elo) → not in any task, as intended. ✓

**Placeholder scan:** The one deliberate data-population step is `MATCH_CITY` (Task 2 Step 4), sourced from the official schedule and gated by the coverage test + `verify-venues`. No vague "add error handling"/"write tests for the above" steps; all code shown.

**Type consistency:** `odds` shape `{ homeWinProb; drawProb; awayWinProb }` is identical across `MatchInput`, `MatchCenterRow`, `MatchDetail`, `MatchOdds`, and `toImpliedProbs`'s `ImpliedProbs`. `venueFor`/`HOST_CITIES`/`MATCH_CITY`/`CityToken` names are consistent between Tasks 2–3. `normalizeTeam`/`resolveMatchNo`/`liveUpset`/`CodedMatch` signatures match between Tasks 7–9.
