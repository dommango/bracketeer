# HessFest × FIFA 26 — Migration handoff

This bundle contains the **HessFest** design system (formerly "Bracketeer × FIFA 26")
and a step-by-step plan for porting it into the `bracketeer/` Next.js codebase.

## About these files

Everything under `components/`, `tokens/`, `styles.css`, `ui_kits/`, and
`guidelines/` is a **design reference** authored in JSX + plain CSS. It is
*not* meant to be dropped into your Next.js app verbatim. The job is to
**recreate these designs in your existing codebase** — keep your
TypeScript + Tailwind + RSC patterns; lift the tokens, the visual
vocabulary, and the component APIs.

The `ui_kits/bracketeer/index.html` is the live interactive prototype —
open it in a browser to see the target end-state (Landing → Pool → Picks
→ Desktop bracket) before you start.

## Fidelity

**High-fidelity.** Colors, type, spacing, motion, and component
behaviour are all pinned. Recreate pixel-perfectly.

---

## What changes for the existing app

The Bracketeer codebase already had a small green/gold palette in
`app/globals.css`. HessFest is a superset — same spine (`--pitch`,
`--gold`, `--ink`, `--paper`) plus:

* **16 FIFA 26 host-city accent colors** (`--city-atlanta` … `--city-vancouver`)
* **Semantic aliases** (`--text-body`, `--surface-card`, `--accent-gold`, …)
* **Status colors** (`--live`, `--positive`, `--warning`, `--negative`) + tints
* **Round tints** (`--round-r32` etc., each routed to a host-city color)
* **Type scale + role aliases** (`--font-display`, `--type-h1`, `--type-score`, …)
* **Spacing, radius, shadow, motion tokens**
* **16 subtle host-city CSS patterns** (`tokens/patterns.css`)
* **A real-flag SVG system** (`Flag.jsx` + 48-team `TEAM_TO_ISO2` map)
* **A desktop knockout-tree component** (`BracketTree.jsx`)

All existing classes that reference `var(--pitch)` etc. keep working.

---

## Migration steps

### 1. Tokens & global CSS

Copy these files (rename `.css` is fine):

```
this/tokens/colors.css       → bracketeer/app/tokens/colors.css
this/tokens/typography.css   → bracketeer/app/tokens/typography.css
this/tokens/spacing.css      → bracketeer/app/tokens/spacing.css
this/tokens/patterns.css     → bracketeer/app/tokens/patterns.css
this/tokens/fonts.css        → bracketeer/app/tokens/fonts.css
```

Replace `bracketeer/app/globals.css` with:

```css
@import "tailwindcss";

@import "./tokens/fonts.css";
@import "./tokens/colors.css";
@import "./tokens/typography.css";
@import "./tokens/spacing.css";
@import "./tokens/patterns.css";

html, body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
}
```

The 6 root variables already defined in `globals.css` (`--pitch`,
`--pitch-dark`, `--gold`, `--ink`, `--paper`) live in `colors.css`
now — keep using the same names everywhere they were referenced.

### 2. Static assets

Copy from `assets/` to `bracketeer/public/`:

```
assets/brand-26-pattern.avif → bracketeer/public/brand-26-pattern.avif
assets/emblem-26.png         → bracketeer/public/emblem-26.png
```

Update image paths in ported components — every `../../assets/...`
reference becomes `/...` (Next.js serves `public/` at root).

### 3. Components

For each `.jsx` in `components/`:

1. Copy to `bracketeer/components/<group>/<Name>.tsx`
2. Convert `.jsx` → `.tsx`. Most files only need the prop interface
   added at the top — copy it from the sibling `.d.ts`.
3. Strip the `import React from "react"` line; Next.js doesn't need it.
4. Replace inline-style image references with `/`-prefixed public paths.
5. Add `"use client"` directive **only if** the component uses
   `useState`/`useRef`/event handlers. The `Card`, `Badge`, `GroupChip`,
   and `MatchCard` components are server-safe.

**Port order (mappings to your existing files):**

| File to update                            | Replace with                                       |
|-------------------------------------------|----------------------------------------------------|
| `app/pool/[code]/Bracket.tsx`             | Use `MatchCard` + `TeamRow`                        |
| `app/pool/[code]/Leaderboard.tsx`         | Use `LeaderboardRow`                               |
| `app/pool/[code]/page.tsx` (header block) | Use `PoolHero`                                     |
| `app/page.tsx` (landing)                  | Mirror `ui_kits/bracketeer/Landing.jsx`            |
| `app/pool/[code]/Chat.tsx` (message render)| Use `ChatBubble`                                  |
| All bare `<button>` tags                  | Use `Button`                                       |
| Tab/section nav                           | Use `Tabs`                                         |

### 4. New routes

These are net-new — no existing route to migrate:

* `app/pool/[code]/bracket/page.tsx` — the desktop knockout tree. Port
  `ui_kits/bracketeer/Desktop.jsx` (uses `BracketTree`). Make it a
  client component since `BracketTree` has interactive accents on cards.
  Wire a "Full bracket →" link on the pool page header.
* `app/pool/[code]/picks/page.tsx` — the picks wizard. Port
  `ui_kits/bracketeer/Picks.jsx`. Wire to your existing pick-persistence
  server actions. The wizard component already simulates autosave —
  swap the `setSavedAt(Date.now())` line for your action call.

### 5. Flags

Port `components/bracket/Flag.tsx`. Defaults to flagcdn.com SVGs. For
offline-safe builds:

```bash
mkdir -p bracketeer/public/flags
# drop SVGs in there named by ISO2 (e.g. br.svg, ar.svg, gb-eng.svg)
```

Then update the default `src`:

```ts
const defaultSrc = (iso2: string) => `/flags/${iso2}.svg`;
```

### 6. Fonts

`tokens/fonts.css` uses Google Fonts (`Archivo Black`, `Inter`,
`JetBrains Mono`) via `@import`. For Next.js best-practice swap to
`next/font/google` in `app/layout.tsx`:

```ts
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";

const display = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display-loaded" });
const body    = Inter({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-body-loaded" });
const mono    = JetBrains_Mono({ subsets: ["latin"], weight: ["400","500","700"], variable: "--font-mono-loaded" });

<html className={`${display.variable} ${body.variable} ${mono.variable}`}>
```

Then in `colors.css`, change the three `--font-*` variables to use the
loaded ones. (You can also just keep the `@import` — Google Fonts is
fine, just slightly slower at first paint.)

---

## Hero pattern + frosted-glass plate

The FIFA 26 hero artwork is the brand's strongest visual signal — we
keep it **uncolored**. The treatment is:

```tsx
<div className="relative rounded-3xl overflow-hidden">
  {/* 1. The pattern, full strength */}
  <div className="absolute inset-0 bg-cover bg-center"
       style={{ backgroundImage: "url(/brand-26-pattern.avif)" }} />
  {/* 2. A soft bottom-only darken for legibility */}
  <div className="absolute inset-0"
       style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />
  {/* 3. Copy sits on a frosted-glass plate */}
  <div className="relative p-6">
    <div className="inline-block rounded-2xl p-4"
         style={{
           background: "rgba(0,0,0,0.42)",
           backdropFilter: "blur(12px)",
           WebkitBackdropFilter: "blur(12px)",
           boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
         }}>
      …headline + subhead…
    </div>
  </div>
</div>
```

Buttons that float over the artwork share the same vocabulary
(`rgba(0,0,0,0.45)` + 10px blur + `1px rgba(255,255,255,0.28)` hairline).

---

## Brand & content rules

`DESIGN_SYSTEM_README.md` (copy of the original `readme.md`) is the full
canonical guide. Skim:

* **Content fundamentals** — sentence case; second person; codes are
  sacred; emoji used sparingly and only for medals + flags + the
  occasional chat reaction.
* **Visual foundations** — mobile-first 480px column; pitch-green is
  the brand; gold is the winning state; host-city colors are accents,
  never page backgrounds.
* **Thumb-zone** — hit targets ≥44px; primary CTAs in the bottom
  two-thirds.
* **Single-tap winner selection** — never a dropdown.

`SKILL.md` is the Agent-Skills entry point if you want Claude Code to
use this system as a callable skill.

---

## Inventory

```
DESIGN_SYSTEM_README.md         Brand & system guide (read first)
SKILL.md                        Agent Skills entry point
styles.css                      The one CSS file consumers link
tokens/
  colors.css                    Brand spine + host-city palette
  typography.css                Type scale + role aliases
  spacing.css                   Space / radius / shadow / motion
  fonts.css                     Google Fonts loader
  patterns.css                  16 subtle host-city CSS motifs
components/
  core/
    Button.jsx + .d.ts          Primary/gold/secondary/ghost/danger pill
    Badge.jsx                   Live/gold/positive/warning/brand pills
    Input.jsx                   Default + pill (chat composer)
    Tabs.jsx                    Sticky pill tabs
    Card.jsx                    Flat / raised / brand / sunk / dashed
    ChatBubble.jsx              Mine / theirs message bubble
  bracket/
    GroupChip.jsx               A–L letter tile, host-city tinted
    Flag.jsx                    Real-SVG flag (flagcdn.com)
    TeamRow.jsx                 One side of a match
    MatchCard.jsx               Match panel with live/final pill
    PickSelector.jsx            Single-tap winner selector
    LeaderboardRow.jsx          Pool leaderboard row
    PoolHero.jsx                Hero with FIFA pattern + frosted plate
    BracketTree.jsx             Desktop 5-round knockout tree
ui_kits/bracketeer/             Interactive recreation — open index.html
  Landing.jsx
  Pool.jsx
  Picks.jsx
  Desktop.jsx
assets/                         Brand assets to copy into public/
guidelines/                     Foundation specimen cards (visual ref)
```
