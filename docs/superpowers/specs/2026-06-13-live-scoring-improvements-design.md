# Live Scoring Improvements — Design Spec

**Date:** 2026-06-13
**Branch:** feat/live-provisional-standings

## Goals

1. Only call the sports API when games are in play.
2. Update scores every minute during live games (currently every 5 minutes).
3. Enrich live matches with goal timelines, cards, possession, and shots.

---

## Architecture

### Approach: Schedule-aware gate on a 1-minute cron

The Railway cron schedule changes from `*/5 * * * *` to `* * * * *`. The external API is only
called when the current time falls within a live window for any scheduled match.

---

## Section 1: Smart Polling Gate

**Files:** `railway.cron.json`, `lib/sports/poll.ts`

A new `shouldPollNow(db, tournamentId)` function runs at the top of `pollScores()` before any
external API call. It queries:

```sql
SELECT 1 FROM "Match"
WHERE "tournamentId" = $1
  AND "scheduledAt" > NOW() - INTERVAL '120 minutes'
  AND "scheduledAt" < NOW() + INTERVAL '5 minutes'
LIMIT 1
```

**Live window:** `[scheduledAt − 5min, scheduledAt + 120min]`
- − 5 min: catch kickoff before it happens
- + 120 min: covers 90 min regulation + 30 min extra time + buffer

If no match falls in any window, `pollScores()` returns `{ skipped: true }` immediately. The only
cost during off-hours is one indexed DB query per minute.

`Match.scheduledAt` is already populated by the seeder for all 104 matches. No new data needed.

---

## Section 2: Enriched Live Poll

**Files:** `lib/sports/client.ts`, `lib/sports/poll.ts`

After the existing two passes (knockout results, group display scores), a new **Pass 3** runs for
any fixture currently in a live API status: `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `INT`, `LIVE`.

For each live fixture, two additional API calls run in parallel:
- `GET /fixtures/events?fixture=<id>` → goal timeline, cards, substitutions
- `GET /fixtures/statistics?fixture=<id>` → possession, shots, corners, fouls

The match minute (`fixture.status.elapsed`) is already present in the main fixture response from
passes 1 & 2 — no extra API call is needed. It is written to `Result.elapsed`.

**Concurrency:** Up to 4 concurrent group-stage matches × 2 calls = 8 extra calls/minute at peak.
Manageable on the unlimited API-Football plan.

**Idempotency:**
- Events: replaced wholesale per match (delete-then-insert in a transaction) on each poll.
- Stats: upserted by `matchId`.
- Both are safe to re-run.

**New client methods:**
```typescript
fetchMatchEvents(fixtureId: number): Promise<RawMatchEvent[]>
fetchMatchStats(fixtureId: number): Promise<RawMatchStats | null>
```

---

## Section 3: Schema Additions

**File:** `prisma/schema.prisma`

### Add `elapsed` to `Result`

```prisma
elapsed Int?  // current match minute; null when not live
```

### New `MatchEvent` model

```prisma
model MatchEvent {
  id          String    @id @default(cuid())
  matchId     String
  match       Match     @relation(fields: [matchId], references: [id], onDelete: Cascade)
  minute      Int
  extraMinute Int?
  type        EventType
  teamCode    String
  playerName  String?
  assistName  String?
  @@unique([matchId, minute, extraMinute, type, teamCode])
}

enum EventType {
  GOAL
  OWN_GOAL
  PENALTY_GOAL
  PENALTY_MISSED
  YELLOW_CARD
  RED_CARD
  YELLOW_RED_CARD
  SUBSTITUTION
}
```

### New `MatchStats` model

```prisma
model MatchStats {
  id        String   @id @default(cuid())
  matchId   String   @unique
  match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  home      Json
  away      Json
  updatedAt DateTime @updatedAt
}
```

`home` / `away` JSON shape:
```typescript
interface TeamStats {
  possession:    number | null
  shots:         number | null
  shotsOnTarget: number | null
  corners:       number | null
  fouls:         number | null
  yellowCards:   number | null
  redCards:      number | null
}
```

The `MatchEvent` composite unique constraint makes the delete-then-insert replacement race-safe.
`MatchStats` is a simple one-to-one upsert.

---

## Section 4: Query Layer

**File:** `lib/pool/queries.ts`

Two new read-only query functions:

```typescript
getMatchEvents(matchId: string): Promise<MatchEvent[]>
// Returns events sorted by (minute, extraMinute asc)

getMatchStats(matchId: string): Promise<MatchStats | null>
// Returns latest stats snapshot
```

`Result.elapsed` rides along through existing query paths (`getPoolView`, bracket view) with no
structural change — it's a new nullable field on an already-returned model.

No new API routes. All live data is written by the cron and read from the DB.

The shape the UI sees per live match:
```typescript
{
  result: Result & { elapsed: number | null },
  events: MatchEvent[],   // sorted chronologically
  stats:  MatchStats | null
}
```

---

## Migration Plan

1. `prisma/schema.prisma` — add `elapsed` to Result; add MatchEvent + EventType + MatchStats
2. `env $ENV npm run db:migrate -- --name live-match-events-and-stats`
3. `env $ENV npx prisma generate`
4. `lib/sports/client.ts` — add `fetchMatchEvents()` and `fetchMatchStats()`
5. `lib/sports/poll.ts` — add `shouldPollNow()`, Pass 3 enrichment, wire both into `pollScores()`
6. `lib/pool/queries.ts` — add `getMatchEvents()` and `getMatchStats()`
7. `railway.cron.json` — change schedule to `* * * * *`

---

## Testing

- Unit: `shouldPollNow()` with mock Match rows at various time offsets
- Unit: event parsing from a fixture API response stub (goal, own goal, card, sub)
- Unit: stats parsing and JSON shape validation
- Integration: full `pollScores()` cycle with a mock HTTP client returning one live fixture
- Verify: `pollScores()` returns `{ skipped: true }` when no match is in any live window
