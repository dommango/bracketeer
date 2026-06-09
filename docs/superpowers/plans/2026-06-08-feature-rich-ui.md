# Broadcast Sport Feature-Rich UI — Implementation Plan

> **⚠️ SUPERSEDED (2026-06-09).** The "Broadcast Sport" design system was dropped in favor of
> the shipped **HessFest × FIFA 26** system. The feature set and functional cores below remain
> valid and are carried forward — only the visual skin is dead. See
> `plans/2026-06-09-fifa26-feature-roadmap.md` for the active plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Bracketeer pool UI into a mobile-first "Broadcast Sport" app shell and add four new surfaces (Home, Player Profile, Match Center + What-if, Daily Summary).

**Architecture:** App-shell + design-system-first. A shared `/pool/[code]` layout hosts a bottom tab bar; server components fetch data via small pure selectors (unit-tested) + thin DB wrappers; client islands handle What-if (pure scoring engine in-browser), chat, and realtime. One schema addition (`ScoreSnapshot`) provides history for movers/recaps. The scoring engine (`lib/scoring/**`) and its golden tests are untouched.

**Tech Stack:** Next 16 (App Router, Turbopack), React 19, Tailwind v4 (`@theme` tokens), Prisma 7 + Postgres, Auth.js v5, Vitest, Google Fonts (Archivo / JetBrains Mono / Hanken Grotesk), Motion (framer-motion) for animation. Visual components are implemented via the **frontend-design** skill against `docs/superpowers/specs/2026-06-08-feature-rich-ui-design.md`.

**Conventions (from the repo):**
- Env-inline dev commands: `ENV='DATABASE_URL=postgresql://food_cost_user:food_cost_dev@localhost:5432/bracketeer AUTH_SECRET=dev-only-secret-at-least-32-characters-long CRON_SECRET=dev-cron-secret APP_BASE_URL=http://localhost:3000'`
- Pure unit tests must NOT import `@/lib/db` or `@/lib/env` (vitest runs without env). Keep logic in pure modules; DB wrappers stay untested by vitest and are exercised by tsx scripts + `npm run build`.
- After any schema change: `env $ENV npm run db:migrate -- --name <name>` then `env $ENV npx prisma generate`.
- Sandbox blocks localhost HTTP → UI gate is `env $ENV npm run build`; backend gate is a tsx script.
- Commit messages: conventional, no attribution footer.

---

### Task 1: Broadcast Sport design system + app shell + bottom nav  (native #16)

**Goal:** Establish the Broadcast Sport token system, the core component kit, and a `/pool/[code]` shell layout with a bottom tab bar and Home as the landing route.

**Files:**
- Modify: `app/globals.css` (add dark Broadcast Sport tokens + font setup)
- Modify: `app/layout.tsx` (load Google Fonts via `next/font/google`)
- Create: `app/pool/[code]/layout.tsx` (shell: header + `<BottomNav>` + `{children}`)
- Create: `components/ui/StatRow.tsx`, `ScoreCard.tsx`, `DeltaChip.tsx`, `StatTile.tsx`, `BottomNav.tsx`, `Pill.tsx`, `SectionLabel.tsx`, `Skeleton.tsx`
- Create: `components/ui/tokens.ts` (TS mirror of token names for type-safe usage, optional)

**Acceptance Criteria:**
- [ ] `globals.css` defines the §5 tokens as CSS variables under a `@theme` block; default app background is the dark base
- [ ] Archivo, JetBrains Mono, Hanken Grotesk loaded via `next/font/google` with CSS variables `--font-display`, `--font-mono`, `--font-body`
- [ ] `BottomNav` renders Home·Table·Bracket·Matches·Chat, marks the active route gold, is fixed to the bottom on mobile, and links to the nested routes
- [ ] `StatRow`/`ScoreCard`/`DeltaChip`/`StatTile`/`Pill` render with tabular numerals and the token colors; leader variant = gold glow, "you" variant = green ring
- [ ] `env $ENV npm run build` is green

**Verify:** `env $ENV npm run build` → compiles `/pool/[code]` and its layout with no errors.

**Steps:**

- [ ] **Step 1: Add Broadcast Sport tokens to `app/globals.css`** (replace the `:root`/`@theme inline` block):

```css
@import "tailwindcss";

:root {
  --bs-bg: #080b12;
  --bs-surface: #10151f;
  --bs-surface2: #171e2b;
  --bs-line: #222c3d;
  --bs-text: #eef3fb;
  --bs-muted: #8893a7;
  --bs-green: #1fe08a;
  --bs-gold: #ffcf4a;
  --bs-live: #ff4257;
  --bs-down: #ff6b7a;
  /* legacy light tokens kept for /signin and marketing until restyled */
  --pitch: #0b6b3a; --pitch-dark: #084d2a; --gold: #f4c542; --ink: #0a0f0d; --paper: #f6f7f5;
}

@theme inline {
  --color-bs-bg: var(--bs-bg);
  --color-bs-surface: var(--bs-surface);
  --color-bs-surface2: var(--bs-surface2);
  --color-bs-line: var(--bs-line);
  --color-bs-text: var(--bs-text);
  --color-bs-muted: var(--bs-muted);
  --color-bs-green: var(--bs-green);
  --color-bs-gold: var(--bs-gold);
  --color-bs-live: var(--bs-live);
  --color-bs-down: var(--bs-down);
  --color-pitch: var(--pitch);
  --color-pitch-dark: var(--pitch-dark);
  --color-gold: var(--gold);
  --font-display: var(--font-archivo);
  --font-mono: var(--font-jetbrains);
  --font-body: var(--font-hanken);
}

.tabular { font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Load fonts in `app/layout.tsx`** — add at top:

```tsx
import { Archivo, JetBrains_Mono, Hanken_Grotesk } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], weight: ["600", "800", "900"], variable: "--font-archivo" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-jetbrains" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-hanken" });
```

Then set the body class: `<body className={`${archivo.variable} ${jetbrains.variable} ${hanken.variable} min-h-screen font-[family-name:var(--font-body)]`}>`.

- [ ] **Step 3: Build the component kit via the frontend-design skill.** Invoke `frontend-design` with the design spec (`docs/superpowers/specs/2026-06-08-feature-rich-ui-design.md` §5) as the brief. Each component is a small presentational file in `components/ui/` with these exact prop contracts (so consumers in later tasks are stable):

```tsx
// DeltaChip.tsx
export function DeltaChip({ delta }: { delta: number }): JSX.Element; // ▲n green / ▼n red / – muted

// StatRow.tsx
export interface StatRowProps {
  rank: number; name: string; points: number; delta?: number;
  initial: string; accent?: string; variant?: "leader" | "you" | "default";
  href?: string;
}
export function StatRow(props: StatRowProps): JSX.Element;

// ScoreCard.tsx
export interface ScoreCardProps {
  home: string; away: string; homeCode: string | null; awayCode: string | null;
  homeScore: number | null; awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINAL"; minute?: string | null; winnerCode?: string | null;
}
export function ScoreCard(props: ScoreCardProps): JSX.Element;

// StatTile.tsx
export function StatTile({ label, value }: { label: string; value: React.ReactNode }): JSX.Element;
// Pill.tsx
export function Pill({ tone, children }: { tone: "live" | "ft" | "ok" | "muted"; children: React.ReactNode }): JSX.Element;
// SectionLabel.tsx
export function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element;
// Skeleton.tsx
export function Skeleton({ className }: { className?: string }): JSX.Element; // shimmer
```

- [ ] **Step 4: Build the shell layout** `app/pool/[code]/layout.tsx` (server component): dark background, a slim header (pool name + tournament + LIVE pill), `{children}`, and a fixed `<BottomNav code={code} />`. `BottomNav.tsx` is a client component using `usePathname()` to mark the active tab; tabs link to `/pool/${code}`, `/pool/${code}/table`, `/.../bracket`, `/.../matches`, `/.../chat`.

- [ ] **Step 5: Verify build**

Run: `env $ENV npm run build`
Expected: PASS — routes compile (the nested routes are added in later tasks; the layout + Home placeholder compile now).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx app/pool/[code]/layout.tsx components/ui
git commit -m "feat(ui): Broadcast Sport design system + app shell + bottom nav"
```

---

### Task 2: Restyle existing screens into the shell (Table, Bracket, Chat)  (native #17, blocked by #16)

**Goal:** Move the existing leaderboard, bracket+groups, and chat into nested routes under the shell, restyled with the new component kit. Data layer unchanged.

**Files:**
- Create: `app/pool/[code]/table/page.tsx` (leaderboard via `StatRow`)
- Create: `app/pool/[code]/bracket/page.tsx` (existing `Bracket`/`GroupStandings`, restyled)
- Create: `app/pool/[code]/chat/page.tsx` (existing `Chat`, restyled)
- Modify: `app/pool/[code]/Leaderboard.tsx`, `Bracket.tsx`, `Chat.tsx` (restyle to tokens) — or replace with kit components
- Modify: `app/pool/[code]/page.tsx` → becomes Home (Task 3); for now keep a temporary redirect/placeholder until Task 3

**Acceptance Criteria:**
- [ ] `/table` renders the cached leaderboard via `getPoolView`/`getLeaderboard` using `StatRow` (leader gold, you green)
- [ ] `/bracket` renders the knockout tree + group standings via `getPoolBracket` in Broadcast Sport
- [ ] `/chat` renders the members-only chat (existing `Chat` island) restyled
- [ ] No change to `lib/pool/*` query signatures; existing 31 unit tests stay green
- [ ] `env $ENV npm run build` green

**Verify:** `npx vitest run` (still 31 passing) AND `env $ENV npm run build` green.

**Steps:**

- [ ] **Step 1:** Create the three route files. Each is a thin server component that reuses the existing queries and passes data to restyled components. Example `table/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getPoolView } from "@/lib/pool/queries";
import { StatRow } from "@/components/ui/StatRow";

export const dynamic = "force-dynamic";

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const pool = await getPoolView(code);
  if (!pool) notFound();
  return (
    <ol className="space-y-2 px-4 py-4">
      {pool.leaderboard.map((r) => (
        <StatRow key={r.entryId} rank={r.rank} name={r.label} points={r.total}
          initial={r.label[0] ?? "?"} href={`/pool/${code}/u/${r.entryId}`}
          variant={r.rank === 1 ? "leader" : undefined} />
      ))}
    </ol>
  );
}
```

- [ ] **Step 2:** Restyle `Bracket.tsx`/`GroupStandings` and `Chat.tsx` to the new tokens via the **frontend-design** skill, preserving their existing prop contracts (`{ view }`, `{ poolId, currentUserId, initialMessages }`).

- [ ] **Step 3: Verify** — `npx vitest run` (31 pass), `env $ENV npm run build` (green).

- [ ] **Step 4: Commit**

```bash
git add app/pool/[code]
git commit -m "feat(ui): restyle table, bracket, chat into the app shell"
```

---

### Task 3: ScoreSnapshot table + Home dashboard  (native #18, blocked by #16)

**Goal:** Add the `ScoreSnapshot` history table (written on each recompute, deduped) and build the personalized Home landing.

**Files:**
- Modify: `prisma/schema.prisma` (+ `ScoreSnapshot` model + Pool/Entry relations)
- Create: `lib/pool/snapshot.ts` (pure dedupe helper + DB writer)
- Create: `lib/pool/snapshot.test.ts`
- Modify: `lib/pool/scoring.ts` (`recomputePool` calls `writeSnapshots` after ranking)
- Create: `lib/pool/home.ts` (pure `buildHome` selector + DB wrapper `getHome`)
- Create: `lib/pool/home.test.ts`
- Modify: `app/pool/[code]/page.tsx` (Home screen)
- Create: `scripts/verify-snapshots.ts` (tsx integration)

**Acceptance Criteria:**
- [ ] `ScoreSnapshot(id, poolId, entryId, totalPoints, rank, reason, capturedAt)` with `@@index([poolId, capturedAt])`, `@@index([entryId, capturedAt])`; migration applied + client regenerated
- [ ] `shouldWriteSnapshot(latest, candidate)` returns false when totals identical (dedupe) — unit-tested
- [ ] `recomputePool` writes one snapshot per entry (deduped) each run
- [ ] `buildHome(...)` returns `{ you, neighbours, nextMatch, todaysMover, recentChat }` from in-memory inputs — unit-tested
- [ ] Home screen renders the standing card, next match, today's mover, chat teaser
- [ ] `scripts/verify-snapshots.ts` passes; build green; scoring tests green

**Verify:** `npx vitest run lib/pool/snapshot.test.ts lib/pool/home.test.ts` → pass; `env $ENV npx tsx scripts/verify-snapshots.ts` → all checks pass.

**Steps:**

- [ ] **Step 1: Schema** — add to `prisma/schema.prisma`:

```prisma
model ScoreSnapshot {
  id          String   @id @default(cuid())
  poolId      String
  entryId     String
  totalPoints Int
  rank        Int
  reason      String   @default("recompute")
  capturedAt  DateTime @default(now())

  pool  Pool  @relation(fields: [poolId], references: [id], onDelete: Cascade)
  entry Entry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([poolId, capturedAt])
  @@index([entryId, capturedAt])
}
```
Add `snapshots ScoreSnapshot[]` to `Pool` and `Entry`. Then:
`env $ENV npm run db:migrate -- --name add_score_snapshot` and `env $ENV npx prisma generate`.

- [ ] **Step 2: Write the failing test** `lib/pool/snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shouldWriteSnapshot } from "./snapshot";

describe("shouldWriteSnapshot", () => {
  it("writes the first snapshot", () => {
    expect(shouldWriteSnapshot(null, { totalPoints: 10, rank: 1 })).toBe(true);
  });
  it("skips when total is unchanged from the latest", () => {
    expect(shouldWriteSnapshot({ totalPoints: 10 }, { totalPoints: 10, rank: 2 })).toBe(false);
  });
  it("writes when the total changed", () => {
    expect(shouldWriteSnapshot({ totalPoints: 10 }, { totalPoints: 12, rank: 1 })).toBe(true);
  });
});
```
Run: `npx vitest run lib/pool/snapshot.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `lib/pool/snapshot.ts`:

```ts
import { prisma } from "@/lib/db";

export function shouldWriteSnapshot(
  latest: { totalPoints: number } | null,
  candidate: { totalPoints: number; rank: number },
): boolean {
  return !latest || latest.totalPoints !== candidate.totalPoints;
}

export async function writeSnapshots(
  poolId: string,
  ranked: { entryId: string; total: number; rank: number }[],
  reason = "recompute",
): Promise<number> {
  let written = 0;
  for (const r of ranked) {
    const latest = await prisma.scoreSnapshot.findFirst({
      where: { entryId: r.entryId },
      orderBy: { capturedAt: "desc" },
      select: { totalPoints: true },
    });
    if (!shouldWriteSnapshot(latest, { totalPoints: r.total, rank: r.rank })) continue;
    await prisma.scoreSnapshot.create({
      data: { poolId, entryId: r.entryId, totalPoints: r.total, rank: r.rank, reason },
    });
    written += 1;
  }
  return written;
}
```
Run: `npx vitest run lib/pool/snapshot.test.ts` → PASS.

- [ ] **Step 4: Integrate into `recomputePool`** (`lib/pool/scoring.ts`): after the leaderboard is produced, call `await writeSnapshots(poolId, leaderboard.map(r => ({ entryId: r.entryId, total: r.total, rank: r.rank })))` before returning.

- [ ] **Step 5: Home selector — failing test** `lib/pool/home.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildHome } from "./home";

const rows = [
  { entryId: "a", label: "Sam", userId: "u-sam", total: 52, rank: 1 },
  { entryId: "b", label: "You", userId: "u-you", total: 50, rank: 2 },
  { entryId: "c", label: "Jo", userId: "u-jo", total: 47, rank: 3 },
];

describe("buildHome", () => {
  it("centres on the current user and shows the gap to the rank above", () => {
    const home = buildHome(rows, "u-you", { mover: { label: "Jo", delta: 12 } });
    expect(home.you?.rank).toBe(2);
    expect(home.gapAhead).toBe(2); // 52 - 50
    expect(home.todaysMover?.label).toBe("Jo");
  });
  it("handles a user with no entry (guest)", () => {
    const home = buildHome(rows, "nobody", {});
    expect(home.you).toBeNull();
  });
});
```
Run → FAIL.

- [ ] **Step 6: Implement** `lib/pool/home.ts` pure `buildHome` + DB wrapper `getHome`:

```ts
import type { LeaderboardRow } from "@/lib/pool/scoring";

export interface HomeView {
  you: LeaderboardRow | null;
  gapAhead: number | null;
  neighbours: LeaderboardRow[];
  todaysMover: { label: string; delta: number } | null;
}

export function buildHome(
  rows: LeaderboardRow[],
  userId: string | null,
  extras: { mover?: { label: string; delta: number } },
): HomeView {
  const you = rows.find((r) => r.userId === userId) ?? null;
  const ahead = you ? rows.find((r) => r.rank === you.rank - 1) : undefined;
  return {
    you,
    gapAhead: you && ahead ? ahead.total - you.total : null,
    neighbours: you ? rows.filter((r) => Math.abs(r.rank - you.rank) <= 1) : rows.slice(0, 3),
    todaysMover: extras.mover ?? null,
  };
}
```
The DB wrapper `getHome(code, userId)` calls `getPoolView`, `getTodaysMover` (from `recap.ts`, Task 6 — until then pass `{}`), and the next-match query, then `buildHome`. (Wire the mover once Task 6 lands; Task 3 ships with `todaysMover: null`.)
Run → PASS.

- [ ] **Step 7: Home screen** `app/pool/[code]/page.tsx` — server component calling `getHome`, rendering the standing card (`StatRow` "you" variant + gap), next match (`ScoreCard`), `StatTile` mover, and a chat teaser. Build via frontend-design to spec §6 Home.

- [ ] **Step 8: Integration script** `scripts/verify-snapshots.ts` (model on `scripts/verify-backend.ts`): recompute a pool twice with a result change between, assert a new snapshot row is written the second time and deduped when unchanged. Run: `env $ENV npx tsx scripts/verify-snapshots.ts`.

- [ ] **Step 9: Commit**

```bash
git add prisma lib/pool/snapshot.ts lib/pool/snapshot.test.ts lib/pool/home.ts lib/pool/home.test.ts lib/pool/scoring.ts app/pool/[code]/page.tsx scripts/verify-snapshots.ts generated/prisma
git commit -m "feat(ui): ScoreSnapshot history + personalized Home dashboard"
```

---

### Task 4: Match Center + match detail + What-if  (native #19, blocked by #16)

**Goal:** A chronological match list, a match-detail screen with the pool pick-split and live swing, and a client-side What-if projector.

**Files:**
- Create: `lib/pool/whatif.ts` (pure) + `lib/pool/whatif.test.ts`
- Create: `lib/pool/match-center.ts` (pure `pickSplit` + DB wrappers `getMatchList`, `getMatchDetail`) + `lib/pool/match-center.test.ts`
- Create: `app/pool/[code]/matches/page.tsx`, `app/pool/[code]/matches/[no]/page.tsx`
- Create: `app/pool/[code]/matches/[no]/WhatIf.tsx` (client island)
- Create: `app/api/pool/[id]/picks/route.ts` (members-only: returns `{ entries: EntryPicks[] }` for client What-if)

**Acceptance Criteria:**
- [ ] `pickSplit(picks, home, away)` → `{ home, away, other }` counts — unit-tested
- [ ] `projectStandings(entries, answer)` ranks by total then label; `applyWhatIf(answer, overrides)` overrides `knockout` immutably — unit-tested
- [ ] `/matches` lists matches with status + your-pick marker; `/matches/[no]` shows pick-split + "if it ends now"
- [ ] `WhatIf` island reprojects standings in-browser via `scorePicks` (no server round-trip after the initial picks fetch)
- [ ] `/api/pool/[id]/picks` is members-only (uses `getPoolAccess`); build green

**Verify:** `npx vitest run lib/pool/whatif.test.ts lib/pool/match-center.test.ts` → pass; `env $ENV npm run build` green.

**Steps:**

- [ ] **Step 1: What-if failing test** `lib/pool/whatif.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyWhatIf, projectStandings } from "./whatif";
import { emptyPicks, type Results, type Picks } from "@/lib/scoring/types";

const answer: Results = { ...emptyPicks(), knockout: { 104: "ARG" }, finalGoals: null };
const picks = (winner: string): Picks => ({ ...emptyPicks(), knockout: { 104: winner } });

describe("what-if", () => {
  it("applyWhatIf overrides a knockout result immutably", () => {
    const next = applyWhatIf(answer, { 104: "BRA" });
    expect(next.knockout[104]).toBe("BRA");
    expect(answer.knockout[104]).toBe("ARG"); // original untouched
  });
  it("projectStandings ranks the entry whose pick matches the (hypothetical) result", () => {
    const entries = [
      { entryId: "a", label: "ArgFan", picks: picks("ARG") },
      { entryId: "b", label: "BraFan", picks: picks("BRA") },
    ];
    const base = projectStandings(entries, answer);
    expect(base[0].entryId).toBe("a"); // ARG won
    const swung = projectStandings(entries, applyWhatIf(answer, { 104: "BRA" }));
    expect(swung[0].entryId).toBe("b"); // now BRA "won"
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `lib/pool/whatif.ts`:

```ts
import { scorePicks } from "@/lib/scoring/score";
import type { Picks, Results } from "@/lib/scoring/types";

export interface EntryPicks { entryId: string; label: string; picks: Picks }
export interface Projected { entryId: string; label: string; total: number; rank: number }

export function applyWhatIf(answer: Results, overrides: Record<number, string>): Results {
  return { ...answer, knockout: { ...answer.knockout, ...overrides } };
}

export function projectStandings(entries: EntryPicks[], answer: Results): Projected[] {
  const scored = entries.map((e) => ({ entryId: e.entryId, label: e.label, total: scorePicks(e.picks, answer).total }));
  scored.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}
```
Run → PASS. (Note: imports only `@/lib/scoring/*` — pure, client-safe.)

- [ ] **Step 3: pick-split failing test** `lib/pool/match-center.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickSplit } from "./match-center";

describe("pickSplit", () => {
  it("counts picks by side", () => {
    const picks = [{ code: "BRA" }, { code: "BRA" }, { code: "ESP" }, { code: "" }];
    expect(pickSplit(picks, "BRA", "ESP")).toEqual({ home: 2, away: 1, other: 1 });
  });
});
```
Run → FAIL.

- [ ] **Step 4: Implement** `lib/pool/match-center.ts`:

```ts
export function pickSplit(
  picks: { code: string }[],
  home: string | null,
  away: string | null,
): { home: number; away: number; other: number } {
  let h = 0, a = 0, o = 0;
  for (const p of picks) {
    if (home && p.code === home) h++;
    else if (away && p.code === away) a++;
    else if (p.code) o++;
  }
  return { home: h, away: a, other: o };
}
```
Plus DB wrappers `getMatchList(code)` (Matches + your pick) and `getMatchDetail(code, no, userId)` (resolved teams via `resolveBracket`, `Pick` rows where `category = "M"+no`, pick-split, "if it ends now" swing using `whatif.projectStandings`). Run → PASS.

- [ ] **Step 5: Picks API** `app/api/pool/[id]/picks/route.ts` — GET, `getPoolAccess` guard (404 for non-members), returns `{ entries: EntryPicks[] }` built from `pickRowsToSubmission`. Used once by the `WhatIf` island.

- [ ] **Step 6: Screens + island** — `/matches` (list via `ScoreCard`), `/matches/[no]` (detail), and `WhatIf.tsx` (client: fetches `/api/pool/[id]/picks` once, holds `overrides` state, calls `applyWhatIf` + `projectStandings` on change, renders projected `StatRow`s). Build via frontend-design to spec §6.

- [ ] **Step 7: Verify** — `npx vitest run lib/pool/whatif.test.ts lib/pool/match-center.test.ts`; `env $ENV npm run build`.

- [ ] **Step 8: Commit**

```bash
git add lib/pool/whatif.ts lib/pool/whatif.test.ts lib/pool/match-center.ts lib/pool/match-center.test.ts app/pool/[code]/matches app/api/pool/[id]/picks
git commit -m "feat(ui): match center, match detail, client-side what-if"
```

---

### Task 5: Player Profile  (native #20, blocked by #16)

**Goal:** A per-entry profile with accuracy, a ✓/✗ knockout hit-grid, category points, and the boldest call.

**Files:**
- Create: `lib/pool/profile.ts` (pure `knockoutHitGrid`, `accuracy`, `boldestCall` + DB wrapper `getProfile`)
- Create: `lib/pool/profile.test.ts`
- Create: `app/pool/[code]/u/[entryId]/page.tsx`

**Acceptance Criteria:**
- [ ] `knockoutHitGrid(picks, answer)` returns one cell per scored knockout match (73–104 excl. 103) with status hit/miss/pending — unit-tested
- [ ] `accuracy(cells)` = round(100 × hits / decided), 0 when none decided — unit-tested
- [ ] Profile screen shows rank/points/accuracy, the hit-grid, category points (from `ScoreBreakdown.byCategory`), boldest call; reachable from `StatRow` href
- [ ] build green

**Verify:** `npx vitest run lib/pool/profile.test.ts` → pass; `env $ENV npm run build` green.

**Steps:**

- [ ] **Step 1: Failing test** `lib/pool/profile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { knockoutHitGrid, accuracy } from "./profile";
import { emptyPicks, type Results, type Picks } from "@/lib/scoring/types";

const answer: Results = { ...emptyPicks(), knockout: { 73: "MEX", 74: "GER" }, finalGoals: null };
const picks: Picks = { ...emptyPicks(), knockout: { 73: "MEX", 74: "BRA" } };

describe("profile", () => {
  it("grades each decided knockout match and leaves the rest pending", () => {
    const grid = knockoutHitGrid(picks, answer);
    const m73 = grid.find((c) => c.matchNo === 73)!;
    const m74 = grid.find((c) => c.matchNo === 74)!;
    const m89 = grid.find((c) => c.matchNo === 89)!;
    expect(m73.status).toBe("hit");
    expect(m74.status).toBe("miss");
    expect(m89.status).toBe("pending");
    expect(grid.some((c) => c.matchNo === 103)).toBe(false); // bronze excluded
  });
  it("accuracy is hits over decided", () => {
    expect(accuracy(knockoutHitGrid(picks, answer))).toBe(50);
    expect(accuracy([])).toBe(0);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `lib/pool/profile.ts`:

```ts
import type { Picks, Results } from "@/lib/scoring/types";

export interface HitCell { matchNo: number; status: "hit" | "miss" | "pending" }

export function knockoutHitGrid(picks: Picks, answer: Results): HitCell[] {
  const out: HitCell[] = [];
  for (let n = 73; n <= 104; n++) {
    if (n === 103) continue; // bronze final not scored
    const actual = answer.knockout?.[n];
    if (!actual) { out.push({ matchNo: n, status: "pending" }); continue; }
    const pick = picks.knockout?.[n];
    out.push({ matchNo: n, status: pick && pick === actual ? "hit" : "miss" });
  }
  return out;
}

export function accuracy(cells: HitCell[]): number {
  const decided = cells.filter((c) => c.status !== "pending");
  if (decided.length === 0) return 0;
  return Math.round((100 * decided.filter((c) => c.status === "hit").length) / decided.length);
}
```
Plus DB wrapper `getProfile(code, entryId)` → loads the entry + picks (`pickRowsToSubmission`), tournament `officialResults` (`asResults`), `ScoreBreakdown`, and assembles `{ label, rank, total, accuracy, grid, byCategory }`. Run → PASS.

- [ ] **Step 3: Screen** `app/pool/[code]/u/[entryId]/page.tsx` via frontend-design to spec §6 Profile.

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run lib/pool/profile.test.ts && env $ENV npm run build
git add lib/pool/profile.ts lib/pool/profile.test.ts "app/pool/[code]/u"
git commit -m "feat(ui): player profile with accuracy + knockout hit-grid"
```

---

### Task 6: Daily Summary + share  (native #21, blocked by #16, #18)

**Goal:** A matchday recap (new leader, biggest mover/faller, table moves) computed from `ScoreSnapshot` deltas, plus a "share to group chat" action.

**Files:**
- Create: `lib/pool/recap.ts` (pure `computeRecap` + DB wrappers `getDailyRecap`, `getTodaysMover`)
- Create: `lib/pool/recap.test.ts`
- Modify: `app/pool/[code]/page.tsx` (Home: expandable Daily Summary)
- Modify: `lib/pool/home.ts` (`getHome` now wires `getTodaysMover`)
- Create: `app/pool/[code]/RecapShare.tsx` (client: posts the recap text to chat via the existing chat API)

**Acceptance Criteria:**
- [ ] `computeRecap(before, after)` returns new leader (if changed), biggest mover (max points delta), biggest faller (most negative rank delta), and per-entry moves — unit-tested
- [ ] Daily Summary renders on Home from `getDailyRecap`
- [ ] "Share recap to group chat" posts via `POST /api/pool/[id]/chat`
- [ ] build green; scoring tests green

**Verify:** `npx vitest run lib/pool/recap.test.ts` → pass; `env $ENV npm run build` green.

**Steps:**

- [ ] **Step 1: Failing test** `lib/pool/recap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRecap } from "./recap";

const before = [
  { entryId: "a", label: "Sam", totalPoints: 40, rank: 2 },
  { entryId: "b", label: "Jo", totalPoints: 41, rank: 1 },
  { entryId: "c", label: "You", totalPoints: 38, rank: 3 },
];
const after = [
  { entryId: "a", label: "Sam", totalPoints: 52, rank: 1 },
  { entryId: "b", label: "Jo", totalPoints: 45, rank: 2 },
  { entryId: "c", label: "You", totalPoints: 43, rank: 3 },
];

describe("computeRecap", () => {
  it("finds the new leader, biggest mover, and biggest faller", () => {
    const r = computeRecap(before, after);
    expect(r.newLeader?.label).toBe("Sam");      // 2 -> 1
    expect(r.biggestMover?.label).toBe("Sam");    // +12 points
    expect(r.biggestFaller?.label).toBe("Jo");    // rank 1 -> 2
    expect(r.moves.find((m) => m.entryId === "c")?.pointsDelta).toBe(5);
  });
  it("returns null leader when the #1 is unchanged", () => {
    expect(computeRecap(after, after).newLeader).toBeNull();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `lib/pool/recap.ts`:

```ts
export interface SnapPoint { entryId: string; label: string; totalPoints: number; rank: number }
export interface Move { entryId: string; label: string; rank: number; pointsDelta: number; rankDelta: number }
export interface Recap {
  newLeader: { entryId: string; label: string } | null;
  biggestMover: { entryId: string; label: string; delta: number } | null;
  biggestFaller: { entryId: string; label: string; rankDelta: number } | null;
  moves: Move[];
}

export function computeRecap(before: SnapPoint[], after: SnapPoint[]): Recap {
  const prev = new Map(before.map((s) => [s.entryId, s]));
  const moves: Move[] = after.map((a) => {
    const b = prev.get(a.entryId);
    return {
      entryId: a.entryId, label: a.label, rank: a.rank,
      pointsDelta: a.totalPoints - (b?.totalPoints ?? a.totalPoints),
      rankDelta: (b?.rank ?? a.rank) - a.rank, // positive = moved up
    };
  });
  const leaderNow = after.find((s) => s.rank === 1) ?? null;
  const leaderBefore = before.find((s) => s.rank === 1) ?? null;
  const newLeader = leaderNow && leaderNow.entryId !== leaderBefore?.entryId
    ? { entryId: leaderNow.entryId, label: leaderNow.label } : null;
  const byPoints = [...moves].sort((a, b) => b.pointsDelta - a.pointsDelta);
  const byRank = [...moves].sort((a, b) => a.rankDelta - b.rankDelta);
  const mover = byPoints[0]?.pointsDelta > 0
    ? { entryId: byPoints[0].entryId, label: byPoints[0].label, delta: byPoints[0].pointsDelta } : null;
  const faller = byRank[0]?.rankDelta < 0
    ? { entryId: byRank[0].entryId, label: byRank[0].label, rankDelta: byRank[0].rankDelta } : null;
  return { newLeader, biggestMover: mover, biggestFaller: faller, moves };
}
```
Plus DB wrappers: `getDailyRecap(poolId, day?)` — load the day's first + latest `ScoreSnapshot` per entry (join `Entry.label`) and call `computeRecap`; `getTodaysMover(poolId)` — returns the recap's `biggestMover` for Home. Run → PASS.

- [ ] **Step 3:** Wire `getHome` to use `getTodaysMover` (remove the Task 3 stub), render Daily Summary on Home, and add `RecapShare.tsx` (client posts a formatted recap string to `POST /api/pool/[id]/chat`). Build via frontend-design to spec §6 Daily Summary.

- [ ] **Step 4: Verify + commit**

```bash
npx vitest run lib/pool/recap.test.ts && env $ENV npm run build
git add lib/pool/recap.ts lib/pool/recap.test.ts lib/pool/home.ts app/pool/[code]
git commit -m "feat(ui): daily summary recap + share to chat"
```

---

### Task 7: Motion + a11y + skeleton polish pass  (native #22, blocked by #17–#21)

**Goal:** Final motion, accessibility, and loading-state polish across all screens.

**Files:**
- Add: `framer-motion` (`npm i framer-motion`)
- Modify: `components/ui/StatRow.tsx` (odometer points, layout animation for reorder), `ScoreCard.tsx` (LIVE pulse), shell (staggered reveal)
- Create: `app/pool/[code]/*/loading.tsx` (skeleton routes for table/bracket/matches/u)
- Create: `components/ui/Odometer.tsx`, `components/ui/PointsFly.tsx` (the "+pts" fly-up, triggered by the realtime `result` event)

**Acceptance Criteria:**
- [ ] Points animate via odometer count-up; leaderboard rows spring-reorder on rank change (framer-motion `layout`)
- [ ] LIVE pill pulses; page content does a staggered reveal on load
- [ ] "+pts" fly-up fires on a `result`/`leaderboard` realtime signal (hook into existing `usePoolStream`)
- [ ] Every animation respects `prefers-reduced-motion` (already globally clamped in globals.css; verify motion components also gate)
- [ ] `loading.tsx` skeletons render for the data routes; visible focus rings; ▲/▼ icons accompany color
- [ ] `env $ENV npm run build` green; `npx vitest run` green (still all passing); scoring + golden tests untouched

**Verify:** `env $ENV npm run build` green AND `npx vitest run` green.

**Steps:**

- [ ] **Step 1:** `npm i framer-motion`. Build `Odometer.tsx` (animated number using `useSpring`/`useTransform`, falls back to the raw number under reduced-motion) and `PointsFly.tsx`.
- [ ] **Step 2:** Add `layout` + `AnimatePresence` to the leaderboard list so rows spring to new positions when ranks change; wrap point displays in `Odometer`. Add staggered reveal to the shell via `motion` stagger. Build via frontend-design to spec §5 Motion.
- [ ] **Step 3:** Add `loading.tsx` skeleton files for `/table`, `/bracket`, `/matches`, `/u/[entryId]` using `<Skeleton>`.
- [ ] **Step 4:** Wire `PointsFly` to `usePoolStream` (`result`/`leaderboard` signal) on Home + Table.
- [ ] **Step 5: Verify** — `env $ENV npm run build` and `npx vitest run` both green.
- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/ui app/pool/[code]
git commit -m "feat(ui): motion, skeletons, and accessibility polish"
```

---

## Self-review

**Spec coverage:** §4 IA → Task 1 (shell/nav). §5 design system → Task 1. §6 screens → Tasks 2 (Table/Bracket/Chat), 3 (Home), 4 (Match Center/What-if), 5 (Profile), 6 (Daily Summary). §7 data (ScoreSnapshot, selectors, client What-if) → Tasks 3, 4, 5, 6. §8 states/a11y + §5 motion → Task 7. §9 testing → per-task unit tests + tsx scripts. §10 rollout → task order matches phases. All sections covered.

**Type consistency:** `EntryPicks`/`Projected` (whatif) consumed by Match Center + What-if island; `HitCell` (profile) used in grid; `SnapPoint`/`Recap` (recap) consumed by Home mover + Daily Summary; `LeaderboardRow` reused in `buildHome`. `pickSplit`/`projectStandings`/`applyWhatIf`/`knockoutHitGrid`/`accuracy`/`computeRecap`/`shouldWriteSnapshot`/`writeSnapshots`/`buildHome` names are stable across tasks.

**Placeholder scan:** No TBD/TODO; visual component implementation is explicitly delegated to the frontend-design skill against the committed spec, with exact prop contracts given so consumers stay typed. Pure-logic steps carry complete test + implementation code.

**Invariant:** No task modifies `lib/scoring/**`; every task keeps `npx vitest run` (incl. golden tests) green.
