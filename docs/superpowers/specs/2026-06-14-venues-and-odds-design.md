# Venues & Cities + Live Odds — Design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)

Two related additions that make fixture cards and match views richer:

1. **Venues & cities** on every fixture card (static, known data).
2. **Live odds** from The Odds API: win-probability bars, a LIVE-only upset alert,
   and a minimal pick-difficulty readout.

Scope decisions already made with the user:

- Schedule scope is **venue + city only** — do **not** touch the existing date/time
  handling (group `scheduledAt` stays null, the hardcoded 19:00 UTC stays).
- Build **both** features in one pass.
- `MatchOdds` is a **separate 1:1 model** (not fields on `Result`).
- The upset alert appears **only while a match is LIVE**, never as a post-match badge.
- **Keep it simple** — pick-difficulty lives only on the match-detail view in this build.

---

## Feature A — Venues & cities on fixture cards

### Data model

Add two nullable columns to `Match`:

```prisma
venue String?   // e.g. "Estadio Azteca"
city  String?   // e.g. "Mexico City"
```

Nullable keeps the schema generic (other tournaments leave them null). One migration.

### Static schedule data

New module `lib/scoring/schedule.ts`:

```ts
export interface MatchVenue {
  venue: string;      // stadium name
  city: string;       // host city display name
  cityToken: string;  // maps to an existing --city-* CSS var, e.g. "mexico-city"
}

// Keyed by internal matchNo (1–104). Venues are fixed and public, so static
// data is more reliable than a runtime feed and adds no dependency.
export const MATCH_SCHEDULE: Record<number, MatchVenue> = { /* ... */ };
```

- `cityToken` values correspond to the **existing** `--city-*` palette already in
  `app/globals.css` (all 16 host cities are defined there).
- **Sourcing + verification (the main risk):** our internal group `matchNo` follows
  `groupMatchups` order (A–L), which is not FIFA's chronological match numbering.
  The mapping from `matchNo` → official venue assignment must be sourced from the
  official FIFA WC2026 schedule and verified. A tsx verification script prints
  `matchNo → home/away (or slot) → venue · city` for an eyeball pass + a coverage
  assertion (all 104 present, every `cityToken` resolves to a defined palette var).

### Seed

`prisma/seed.ts` writes `venue`/`city` from `MATCH_SCHEDULE` inside the existing
match upsert. Date handling is untouched.

### Plumbing

- Add `venue: string | null` and `city: string | null` to `MatchInput` and
  `MatchCenterRow` in `lib/pool/match-center.ts` (pure, threaded straight through
  `buildRow`).
- The `getMatchCenter` / match-detail selectors in `lib/pool/queries.ts` select the
  new columns and pass them in.

### UI

- **Fixture cards:** a venue line — "Estadio Azteca · Mexico City" — accented with
  the city's palette color (`var(--city-<token>)`). Renders only when present.
- **Match detail:** a fuller venue/city header.
- Both the group-stage and knockout fixture lists pick this up automatically since
  they share the row model.

---

## Feature B — Live odds (The Odds API)

### Provider

[The Odds API](https://the-odds-api.com/) — free tier 500 credits/month, no card.
Sport key `soccer_fifa_world_cup`, market `h2h` (1X2), one region per call = 1
credit/refresh. One call returns the whole upcoming slate, so credits scale with
refresh cadence, not match count. Commercial use allowed; caching encouraged.

### Env

Add `ODDS_API_KEY` to `lib/env.ts` with graceful degradation (same pattern as the
Google / email / sports keys — the feature disables cleanly when unset, and all
odds UI is omitted).

### Client — `lib/odds/client.ts`

Fetch `soccer_fifa_world_cup` with `markets=h2h` and one `regions` value. Returns
events shaped as: `{ homeName, awayName, commenceTime, decimalHome, decimalDraw,
decimalAway }` (consensus or first bookmaker — keep it simple, one price set).

### Mapping — `lib/odds/map.ts` (pure, unit-tested)

- `normalizeTeam(name) → code | null` — built from `TEAMS` plus an alias table for
  the known mismatches ("Korea Republic"/"South Korea", "United States"/"USA",
  "Côte d'Ivoire"/"Ivory Coast", "IR Iran", etc.). Returns null when unmatched
  (event is skipped, not guessed).
- `resolveMatchNo(homeCode, awayCode, matches) → matchNo | null` — attach an odds
  event to a `matchNo` by its two known team codes. Group matches map immediately
  (draw is done); knockout matches map once their feeders resolve to real teams.
- `toImpliedProbs(dH, dD, dA) → { homeWinProb, drawProb, awayWinProb }` — invert
  each decimal price (`1/d`) and **normalize the three so they sum to 1**, stripping
  the bookmaker overround. This normalized triple is also the pick-difficulty signal.

### Data model — `MatchOdds`

Separate 1:1 model, mirroring the existing `MatchStats` shape:

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

`Match` gains `odds MatchOdds?`. Writes are upserts (immutable replace, no mutation).

### Ingestion — `/api/cron/poll-odds`

A new `CRON_SECRET`-guarded route (separate from score polling), lower cadence —
a few refreshes/day stays far under 500 credits/month. For each returned event:
normalize teams → resolve `matchNo` → compute implied probs → upsert `MatchOdds`.
No-op (and logs) when `ODDS_API_KEY` is unset. Cached; never fetched per page-view.
Add to `scripts/cron.mjs` alongside the existing job.

### Display

- **Win-probability bar** (H / D / A %) on fixture cards and the match-detail header,
  with the favorite marked. Rendered only when `MatchOdds` exists.
- **Upset alert — LIVE only.** While `status === "LIVE"`, if the team currently
  ahead on the scoreboard was the pre-match underdog (its implied win prob < the
  opponent's), show a "⚡ Upset" badge. Hidden when tied, when SCHEDULED, and when
  FINAL. Pure helper `liveUpset(row, odds)` — unit-tested.
- **Pick difficulty (match detail only, minimal).** Next to your pick, show the
  implied probability you backed — "you backed a 24% pick." Nothing elsewhere this
  build.

---

## Cross-cutting

### Testing (TDD)

Write tests first for every pure unit:

- `toImpliedProbs` — normalization sums to 1; overround stripped.
- `normalizeTeam` — all 48 codes + every alias resolve; unknown → null.
- `resolveMatchNo` — group + knockout matching; ambiguous/unknown → null.
- `liveUpset` — underdog-ahead true; favorite-ahead, tied, non-LIVE → false.
- `MATCH_SCHEDULE` coverage — 104 entries, every `cityToken` is a defined palette var.

One Prisma migration; run `npx prisma generate` after. `npm run build` (eager route
compile) is the UI gate since localhost HTTP is sandboxed. `npx vitest run` green.

### Verification scripts (tsx)

- `scripts/verify-venues.ts` — print matchNo → teams/slot → venue · city; assert
  coverage.
- `scripts/verify-odds.ts` — fetch (or fixture), normalize, resolve, print mapped
  matchNos + implied probs; flag any unmatched event.

### Deferred (flagged, out of scope)

- Pool-level "genius / upset points" leaderboard (Tier-1 synergy) — not in this build.
- Pick-difficulty in the profile / a "boldest brackets" pool view — not in this build.
- Elo fallback for matches with no bookmaker odds — note only; not built.

---

## File-level summary

**New**
- `lib/scoring/schedule.ts` — `MATCH_SCHEDULE`
- `lib/odds/client.ts` — The Odds API fetch
- `lib/odds/map.ts` — team normalize, matchNo resolve, implied-prob, upset helpers
- `app/api/cron/poll-odds/route.ts` — odds poller
- `scripts/verify-venues.ts`, `scripts/verify-odds.ts`
- Tests alongside each pure module.

**Modified**
- `prisma/schema.prisma` — `Match.venue/city`, `MatchOdds` model, `Match.odds`
- `prisma/seed.ts` — write venue/city
- `lib/env.ts` — `ODDS_API_KEY`
- `lib/pool/match-center.ts` — venue/city + odds fields on the row model + helpers
- `lib/pool/queries.ts` — select new columns + odds relation
- `scripts/cron.mjs` — register the odds job
- Fixture-card + match-detail components — venue line, win-prob bar, upset badge,
  pick-difficulty label.
