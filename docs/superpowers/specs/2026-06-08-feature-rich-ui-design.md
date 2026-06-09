# Bracketeer — Feature-Rich UI Design

**Date:** 2026-06-08
**Status:** Approved in brainstorm; ready for implementation planning
**Theme:** "Broadcast Sport" · mobile-first · comprehensive overhaul

## 1. Context & goals

Bracketeer is a World Cup 2026 bracket-pool app (Next 16 App Router, Prisma 7,
Postgres, Auth.js v5). The backend is feature-complete (scoring engine, admin
result entry + propagation, import, chat, SSE realtime, cron) and the current UI
is live for the friend group. This project is a **comprehensive UI overhaul**:
restyle every screen into a distinctive "Broadcast Sport" look **and** add four new
surfaces. The current UI stays live throughout; this ships incrementally on top.

Kickoff is 2026-06-11, but the existing UI (and the original HTML tool) remain the
fallback, so this work is upside, not a blocker.

**Non-negotiable invariant (inherited):** the scoring engine (`lib/scoring/**`) and
its byte-for-byte parity stay untouched. All new features read from it; none change it.

## 2. Scope

**In scope**
- Restyle all existing screens to Broadcast Sport (leaderboard, bracket, groups, chat, sign-in, admin lightly).
- App shell with a bottom tab bar and a personalized **Home** landing.
- New surfaces: **Home dashboard**, **Player Profile**, **Match Center + match detail with What-if**, **Daily Summary**.
- Broadcast Sport design system (tokens, type, components, motion).
- One schema addition: `ScoreSnapshot` (history for movers/recaps/trends).

**Out of scope (deferred)**
- Head-to-head bracket compare (profiles ship without it; compare entry point may stub).
- Achievements/badges and long-form "season narrative."
- Push / email notifications (Home surfaces the same info in-app; no delivery infra yet).
- Sports-API auto-polling UI (manual entry remains primary).

## 3. Approach

**App-shell + design system first.** Build the Broadcast Sport token system and
core component kit, plus the bottom-tab app shell with Home as the landing, then
fill screens. Chosen over incremental-restyle and vertical-slices because a
comprehensive overhaul + four new surfaces needs a consistent token system and a
real navigational home rather than more tabs on one page.

## 4. Information architecture & navigation

The pool becomes an app with a **bottom tab bar** (5 = mobile comfort max):

```
/pool/[code]                app shell (shared layout: header + bottom nav)
  ├─ (Home)                 personalized dashboard — the landing
  ├─ /table                 leaderboard (restyled) → links to profiles
  ├─ /bracket               knockout bracket + group standings (groups fold in)
  ├─ /matches               Match Center (chronological match list)
  └─ /chat                  pool chat (restyled)
Sub-routes (not tabs):
  · /u/[entryId]            player profile
  · /matches/[no]           match detail: who-picked-whom + What-if
  · Daily Summary           on Home, expandable (own deep-link optional)
Outside the shell:          /  (marketing) · /signin · /admin
```

Active tab = gold; Home is the default route. Profiles and Daily Summary are
reached contextually to keep the bar uncluttered.

## 5. Design system — "Broadcast Sport"

Dark, high-contrast, scoreboard energy. Tokens live as CSS variables; numerals are
**always tabular** so points/scores never jitter.

**Color tokens**
| Token | Value | Use |
|---|---|---|
| `--bg` | `#080b12` | near-black navy base |
| `--surface` / `--surface2` | `#10151f` / `#171e2b` | panels, rows |
| `--line` | `#222c3d` | borders |
| `--text` / `--muted` | `#eef3fb` / `#8893a7` | ink |
| `--green` | `#1fe08a` | primary accent (brightened pitch green) |
| `--gold` | `#ffcf4a` | leader / #1 / highlights |
| `--live` | `#ff4257` | LIVE state |
| `--down` | `#ff6b7a` | negative delta |

Atmosphere: subtle radial "stadium glow" gradients (green + gold) over the base.

**Typography (pairing "B · Modern Broadcast")**
- Headlines: **Archivo** (heavy, expanded — `font-stretch:125%`).
- Numerals / stats: **JetBrains Mono** (tabular figures).
- Body / UI: **Hanken Grotesk**.
- Loaded via Google Fonts with `display=swap`.

**Core components (the kit)**
- `StatRow` — rank · avatar · name · `DeltaChip` · tabular points. Leader = gold border + glow; "you" = green ring.
- `ScoreCard` — two teams + tabular score + status pill (LIVE pulses red / FT muted / kickoff time).
- `DeltaChip` — ▲ green / ▼ red / – muted (icon **and** color).
- `StatTile` — small labelled metric (mover, boldest call).
- `BottomNav` — 5 items, active = gold filled icon.
- `SectionLabel`, `Pill/Badge`, skeleton shimmer.

**Motion** (Motion library via frontend-design; CSS where simpler)
- Odometer count-up on point changes.
- Spring-based **row reorder** when ranks change (FLIP).
- Pulsing LIVE dot; staggered load reveals (`animation-delay`).
- "+pts" fly-up when a result lands (wired to existing SSE realtime).
- All gated behind `prefers-reduced-motion`.

## 6. Screens

Each screen is a server component for data + client islands for interactivity.
**frontend-design** builds the actual components to the Broadcast Sport spec.

- **Home (landing)** — "your standing" card (rank + delta + points + gap to neighbours), "next match for you" (your pick), "today's mover," latest-chat teaser, expandable **Daily Summary**. Aggregation selector over existing data + snapshots.
- **Table** — restyled leaderboard (`StatRow` kit); tap a row → profile; category chips retained.
- **Bracket** — restyled knockout tree + group standings (groups fold in, as today). Uses existing `bracket-view`.
- **Match Center** (`/matches`) — chronological match list with status + your pick marker.
- **Match detail** (`/matches/[no]`) — score + your pick status; **pool pick-split** ("7 picked Brazil / 4 Spain", from `Pick` rows); live "**if it ends now**" swing; **What-if** segmented control reprojecting the table (client-side).
- **Player Profile** (`/u/[entryId]`) — rank/points/**accuracy**, ✓/✗ **knockout hit-grid** (picks vs `resolveBracket`), category-points breakdown, boldest call. (Compare = deferred.)
- **Daily Summary** — matchday recap: new leader, biggest mover/faller, **table moves** (rank deltas), and "**share recap to group chat**." From `ScoreSnapshot` deltas grouped by day.
- **Chat** — restyle of the existing members-only chat.
- **Sign-in / marketing / admin** — light Broadcast-Sport pass (admin functional-first).

## 7. Data & architecture

**Reused unchanged:** scoring engine, `officialResults`, `resolveBracket`, `Pick`
rows, `recomputePool`, SSE `notifyPool`, auth/access, chat.

**Schema change (the only one): `ScoreSnapshot`**
```
ScoreSnapshot {
  id, poolId, entryId, totalPoints Int, rank Int,
  reason String,        // "recompute" | "matchday:<date>" | ...
  capturedAt DateTime @default(now())
  @@index([poolId, capturedAt]); @@index([entryId, capturedAt])
}
```
Written per entry on each `recomputePool` (debounced/deduped so identical totals
don't spam rows; prune beyond a retention window). Powers movers, table-moves,
profile trends. The "matchday" boundary for recaps is per calendar day (derive
from `capturedAt`); a recap groups the snapshots that closed that day.

**New read-side selectors (no new storage):**
- Home aggregation (rank + neighbours + next match + today's mover + recent chat).
- Match-Center pick-split (`Pick` rows where `category = M{n}`, `code ∈ {home,away}`).
- Profile accuracy + hit-grid (entry picks vs `resolveBracket(officialResults)`).
- Daily recap (snapshot deltas grouped by day).

**What-if = client-side.** `scorePicks` is pure TS → runs in the browser. Fetch the
pool's picks + current `officialResults` once; for a hypothetical, override
`knockout[n]`, re-score all entries, render projected ranks. Zero server round-trip.

**Rendering:** nested App-Router routes under `/pool/[code]` with a shared shell
layout (header + `BottomNav`). Server components fetch; client islands handle
What-if / chat / realtime. Realtime reuses `notifyPool`; add a `recap` event when a
matchday closes so Home/Daily refresh.

## 8. States, motion, accessibility

- **States**: skeleton shimmers (Broadcast Sport), pre-tournament empty states, offline PWA shell, error toasts. Reuse the existing 15s poll fallback for realtime.
- **Motion**: as in §5; all behind `prefers-reduced-motion`.
- **A11y**: tabular numerals, visible focus rings, color never the sole signal (▲▼ icons), sufficient contrast on the dark theme, semantic landmarks for the tab bar.

## 9. Testing strategy (TDD)

- **Unit (pure logic, test-first):** What-if projection; mover/rank-delta computation from snapshots; profile accuracy + hit-grid; Home aggregation selectors. Mirror the existing `lib/` test pattern (no DB import in pure tests).
- **Integration:** a tsx script (like `scripts/verify-backend.ts`) exercising the new queries + `ScoreSnapshot` writes against the dev DB.
- **Build-green** for every new route/screen (sandbox blocks localhost HTTP; `npm run build` is the UI gate).
- **Invariant:** scoring engine + golden tests stay green and untouched.

## 10. Rollout / sequencing

Current UI stays live throughout. Suggested phases (each independently shippable):
1. Design system + app shell + bottom nav (foundation).
2. Restyle existing screens into the shell (Table, Bracket, Chat).
3. `ScoreSnapshot` + Home dashboard.
4. Match Center + match detail + What-if.
5. Player Profile.
6. Daily Summary + share.
7. Motion polish pass + a11y/reduced-motion + skeletons.

## 11. Risks & open questions

- **Snapshot volume**: dedupe identical recomputes + retention pruning to bound growth.
- **What-if payload**: shipping all picks to the client is fine within a pool (picks are pool-visible), but keep the payload lean (codes only).
- **"Matchday" definition** for recaps: starting with per-calendar-day; revisit if the group prefers per-round.
- **Desktop**: mobile-first; responsive handles desktop, but a wider bracket layout could be a later enhancement.
