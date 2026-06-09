# HessFest × FIFA 26 — Feature Roadmap

**Date:** 2026-06-09
**Status:** Active. Supersedes `2026-06-08-feature-rich-ui.md` (Broadcast Sport).
**Theme:** HessFest × FIFA 26 design system (pitch green + gold, 16 host-city accents), mobile-first 480px.

## Context

The WC2026 MVP is shipped and verified: scoring engine (byte-compatible, golden-tested),
CSV import, manual admin result entry, leaderboard, bracket, groups, chat, Auth.js v5, and
SSE realtime — all live on `/pool/[code]` and re-skinned in the FIFA 26 design system
(committed `8941c6a`, on `main`). The June 11 kickoff is not blocked by anything in this doc.

This roadmap builds out the *feature-rich* enhancements (dashboards, match center, profiles,
recaps) that were designed in the now-superseded `2026-06-08-feature-rich-ui.md`. That plan's
**functional cores are still valid and reused here**; only its visual skin (the "Broadcast
Sport" token system + component kit) is discarded. We re-skin the same feature set onto the
FIFA 26 system already in `app/globals.css`.

**Why now:** richer in-tournament engagement for the friend group (Tiers 1–3), then the
multi-tenant "anyone can run a pool" platform (Tier 4).

## Working method: contract-first, two tracks in parallel

The design system is already built and tokenized, so UI work is *composition of known
patterns*, not exploration. Scoring output is the load-bearing data every screen renders.
Therefore, **lead with the data contract, then fork code and design in parallel.**

Per-feature loop:

1. **Define the data contract** — write the TypeScript return type for the feature's selector
   + any API response shape. This is the only serialization point.
2. **Fork:**
   - **Code track** — implement the selector + unit tests (Vitest, no DB); add migration if
     needed; wire the API route.
   - **Claude Design track** — design the screen against the contract using FIFA 26 tokens,
     working from fixture data matching the interface; output JSX.
3. **Converge** — drop the JSX in, swap fixtures for the real selector, wire realtime signals.

Exception: genuinely new visual patterns (knockout hit-grid, pick-split bar, points odometer)
get a quick Claude Design probe *before* the contract is frozen, to confirm they fit the system.

**Design system is non-negotiable** (see `app/globals.css` tokens + `Leaderboard.tsx`,
`Bracket.tsx`, `Chat.tsx`, `Flag.tsx` patterns): pitch green is the brand; gold is the winning
state only; host-city accents tag/tint, never page backgrounds; FIFA pattern only under a dark
scrim; ≥44px hit targets; tabular mono numerics for scores/codes/IDs; sentence case copy.

## Tier 0 — Navigation: nested routes + bottom tab bar

Decision made: split the single `/pool/[code]` page into nested routes under a shared layout
with a fixed **bottom tab bar**. Recaps stay as plain chat text (no deep-link routing needed).

Target route structure:

```
app/pool/[code]/
  layout.tsx            ← NEW: hero header + <BottomNav> + bottom padding for the bar
  page.tsx              → Home dashboard            (Tier 2)
  table/page.tsx        → Leaderboard               (move existing Leaderboard.tsx)
  bracket/page.tsx      → Bracket + groups          (move existing Bracket.tsx; desktop tree later)
  matches/page.tsx      → Match Center              (Tier 2)
  matches/[no]/page.tsx → Match detail + What-if    (Tier 2)
  u/[entryId]/page.tsx  → Player profile            (Tier 2; reached from a leaderboard row, not a tab)
  chat/page.tsx         → Chat                      (move existing Chat.tsx)
```

The route split is **data-layer-neutral** — same `getPoolView` / `getPoolBracket` /
`listMessages` calls (`lib/pool/queries.ts`, `lib/pool/chat.ts`), just relocated from today's
all-in-one `app/pool/[code]/page.tsx`. The hero header and the tab bar live in the new
`layout.tsx`; per-route pages render only their section.

**Bottom-nav contract** (the bar itself is being designed separately in Claude Design):

- 5 tabs in order: `Home` · `Table` · `Bracket` · `Matches` · `Chat`, each linking to its route.
- Active tab = current path, wired with `usePathname()` (client component).
- `position: fixed`, full-width, bottom, with `env(safe-area-inset-bottom)` for the iPhone home bar.
- ≥44px hit targets; FIFA 26 tokens only — active in pitch green or gold, inactive `--ink-3`.
- Page content needs bottom padding equal to the bar height so nothing hides behind it.

## Tier 1 — Foundation data: `ScoreSnapshot`

Adds point/rank history so movers and recaps can be computed. (Reuse the design from the old
plan's Task 3 schema + dedup logic.)

- **Schema:** new `ScoreSnapshot` model in `prisma/schema.prisma` — `entryId`, `totalPoints`,
  `rank`, `capturedAt` (+ index on `(poolId, capturedAt)` or `(entryId, capturedAt)`). Migration
  via `npm run db:migrate -- --name score_snapshot` then `npx prisma generate`.
- **Capture:** write a snapshot row per entry inside `recomputePool()` (`lib/pool/scoring.ts`),
  deduplicated so an unchanged recompute doesn't spam identical rows (compare to latest snapshot).
- **Contract:** `ScoreSnapshot` row shape + a `getMovers(poolId, since)` selector return type.
- **Tests:** pure dedup + delta logic unit-tested (Vitest, no DB).

Scoring engine (`lib/scoring/**`) and its golden tests stay untouched.

## Tier 2 — Member screens

Each is a selector + a screen. Build the selector + tests (code track) while the screen is
designed against the contract (Claude Design track).

- **Home dashboard** (`page.tsx`) — `buildHome(poolId, userId)`: your standing, gap-to-leader,
  next match, today's biggest mover (`getTodaysMover`, needs Tier 1), chat teaser.
- **Match Center** (`matches/page.tsx`) — chronological match list with your-pick marker and
  live/scheduled/final status. Reads from `Match`/`Result` + `getPoolBracket`.
- **Match detail + What-if** (`matches/[no]/page.tsx`) — teams playing, the pool's pick-split
  (home/away/other counts), "if it ends now" standings swing; client-side `WhatIf.tsx` island
  that recomputes standings in-browser using the pure scoring engine. Needs new
  `GET /api/pool/[id]/picks` (members-only) to feed the island.
- **Player profile** (`u/[entryId]/page.tsx`) — `knockoutHitGrid` (✓/✗ per scored knockout
  match), `accuracy` (%), category breakdown, boldest call. Both selectors pure + tested.

## Tier 3 — Polish

- Motion using existing FIFA 26 motion tokens (`--ease-standard`, `--dur-1/2/3`): points
  count-up odometer, leaderboard row reorder spring, LIVE pulse (already in `globals.css`).
  Wire "+pts" fly-up to realtime `result`/`leaderboard` signals via `usePoolStream`.
- Skeleton `loading.tsx` for each data route.
- Accessibility pass (focus states, reduced-motion, contrast on host-city accents).

## Tier 4 — Multi-tenant platform (post-kickoff)

Not needed for the June 11 friend group (picks were made in the HTML tool and CSV-imported),
required for the "anyone can run a pool" goal:

- Pool creation UX (no `/pool/create` today; pools are seeded).
- Join-by-code / membership flow (`Membership` model exists, no UI).
- **In-app pick submission/editing** (today picks are CSV-only).
- Account management, notifications (email/push), sports-API live feed wiring
  (`lib/sports/fixtures-map.ts` is stubbed pending the 2026 draw + provider fixture IDs).

## Critical files

- `app/pool/[code]/page.tsx` — split into `layout.tsx` + nested route pages (Tier 0).
- `app/pool/[code]/{Leaderboard,Bracket,Chat,Flag}.tsx` — relocate into routes; reuse as-is.
- `app/globals.css` — token source of truth; consume, never override.
- `prisma/schema.prisma` — add `ScoreSnapshot` (Tier 1).
- `lib/pool/scoring.ts` (`recomputePool`) — snapshot capture (Tier 1).
- `lib/pool/queries.ts`, `lib/pool/chat.ts` — existing read helpers, reused by new routes.
- `lib/scoring/**` — load-bearing, untouched; reused read-only by the What-if island.
- New: `lib/pool/home.ts`, `lib/pool/profile.ts`, `lib/pool/movers.ts` (pure selectors);
  `app/api/pool/[id]/picks/route.ts`; `app/pool/[code]/BottomNav.tsx`, `WhatIf.tsx`.

## Verification

- **Unit:** `npx vitest run` — selectors (`buildHome`, `getTodaysMover`, `knockoutHitGrid`,
  `accuracy`, snapshot dedup) covered without a DB. Scoring golden tests stay green.
- **Build:** `env $ENV npm run build` (eager route compilation validates every new route) +
  `npm run typecheck`. (`$ENV` per `CLAUDE.md`; localhost HTTP is sandbox-blocked.)
- **End-to-end backend:** `env $ENV npx tsx scripts/import-fixtures.ts` then exercise
  `recomputePool` to confirm snapshots are written and movers compute.
- **Visual:** against a seeded demo pool — confirm each route renders on the 480px mobile
  column and the desktop variant, bottom nav active states track the path, ≥44px targets,
  tabular numerics, FIFA pattern only under scrim.
