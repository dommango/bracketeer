# Bracketeer × FIFA 26 Design System

A design system for **Bracketeer** — a tournament bracket-pool app whose first
production tenant is the **FIFA World Cup 2026** (kickoff June 11, 2026; 48
teams, 104 matches, 16 host cities across the USA, Canada, and Mexico).

The system blends two voices:

* **Bracketeer's product spine** — pitch-green + gold, dense, mobile-first,
  ergonomically optimized for high-stress kickoff moments.
* **FIFA 26's brand palette** — the bold, multi-colored "26" wordmark and the
  16 host-city accent colors that act as confetti on top of the green-and-gold
  foundation.

The result reads as a serious sports utility, not a marketing site.

## Sources we drew from

| Source                                                                | Used for                                                |
|-----------------------------------------------------------------------|---------------------------------------------------------|
| `bracketeer/` (Next.js codebase, mounted)                             | Layout, copy, components, color spine, type stack       |
| `uploads/2026_FIFA_World_Cup_emblem.svg.png`                          | Trophy/2026 emblem → `assets/emblem-26.png`             |
| `uploads/FIFA-World-Cup-26-Official-Brand.avif`                       | Hero background → `assets/brand-26-pattern.avif`        |
| `uploads/HostCitySwatches.jpg`                                        | 16 host-city accent colors                              |

Notable codebase references:
* `bracketeer/app/globals.css` — defines `--pitch`, `--pitch-dark`, `--gold`, `--ink`, `--paper` (we extend, don't replace).
* `bracketeer/app/page.tsx`, `app/pool/[code]/page.tsx`, `app/admin/page.tsx`, `app/signin/page.tsx` — the live screens we mirror in `ui_kits/bracketeer/`.
* `bracketeer/lib/scoring/data.ts` — TEAMS, GROUPS, R32…FINAL topology.

## Root manifest

```
styles.css                # entry — only @imports
tokens/
  fonts.css               # Google Fonts loader (Archivo Black + Inter + JetBrains Mono)
  colors.css              # brand spine + host-city palette + semantic aliases
  typography.css          # scale, role aliases, weight tokens
  spacing.css             # space / radius / shadow / motion / hit-min
  patterns.css            # subtle host-city CSS pattern motifs
guidelines/               # foundation specimen cards (Type / Colors / Spacing / Brand)
components/
  core/                   # Button, Badge, Card, ChatBubble, Input, Tabs
  bracket/                # GroupChip, TeamRow, MatchCard, PickSelector, LeaderboardRow,
                          # PoolHero, Flag, BracketTree
ui_kits/
  bracketeer/             # Landing + Pool + Picks + Desktop interactive recreation
assets/
  emblem-26.png           # the 2-6 trophy lockup
  brand-26-pattern.avif   # full-bleed striped pattern
  host-city-swatches.jpg  # reference sheet of all 16 host-city color blocks
  bracket-icon.svg        # the in-product bracket logomark
SKILL.md                  # Agent-Skills entry point
```

---

## Content fundamentals

Bracketeer's voice is **plainspoken and competitive** — the way friends talk in
a group chat during a match, never a marketing brochure.

* **Casing** — sentence case for everything but proper nouns. Headlines do
  not Title-Case. Buttons read "Save bracket" not "Save Bracket".
* **Pronouns** — second person, addressed to the user. "*Your* pick", "*Your*
  bracket auto-saves." Never "the user" or "we".
* **Action verbs** — short and declarative. "Make a pick." "Open." "Save
  bracket." "Lock it in." Avoid hedging like "Continue", "Submit", "Proceed".
* **Numbers** — always digits, never spelled out. "48 teams", "104 matches",
  "12 entries". Tabular numerics are the rule for any column the eye scans.
* **Time** — short and concrete. "Kickoff Jun 11", "Sat Jun 27 · 15:00 ET",
  "Live · 67'", "Last updated · 2 minutes ago". Never "yesterday at 4pm".
* **Codes are sacred** — team codes (`BRA`, `ARG`, `ENG`), match IDs (`M73`),
  and join codes (`FIXTUR`) are always uppercase mono and never abbreviated
  further.
* **Emoji** — sparingly, and only for celebratory or peer-to-peer voice. 🥇🥈🥉
  on top-3 leaderboard rows; 🇧🇷-style flags next to team names in compact lists
  and on pick buttons; the occasional 👋 in chat-empty states. Never as
  decoration in headings, error messages, or admin tools.
* **Tone in stress moments** — kickoff-lockout copy stays calm and concrete:
  "Autosaved", "12 of 72 picks made", "Kickoff in 36h". No "Hurry!" or
  countdowns that exhort.

**Examples that exist in-product today**:

> *Run a World Cup 2026 pool with your friends.*
> *Live scores, a realtime leaderboard, and group chat — all in one place.*
> *Have a join code? Open your pool by visiting `/pool/CODE`.*
> *Group standings will appear here once the group stage is decided.*

---

## Visual foundations

**Layout.** Mobile-first 480px content column. The pool view is sticky-tabs
under a hero card. The bracket itself never renders as a horizontal tree on
phone — it's a vertical, round-by-round list (Live & Next is the default
section so users see what matters now without scrolling).

**Color.** Pitch-green (`#0B6B3A`) is the brand. Gold (`#F4C542`) marks the
winning state — leaders, golden boot, lock-in CTAs. Ink (`#0A0F0D`) on Paper
(`#F6F7F5`) for body. The 16 host-city colors are accents: they tag groups,
color user avatars, and tint the four left-edges of knockout-round matchcards
— the bracket reads as a chromatic sweep from group-stage greens to royal
blues in R32 to magenta in QF to gold at the Final.

**Type.** Three families. **Archivo Black** for display — chunky enough to
echo the official "26" wordmark, used for scores, team codes, headlines.
**Inter** for body and UI chrome. **JetBrains Mono** for tabular numerics,
join codes, match IDs, timestamps. (FIFA's licensed brand fonts are not
shipped — this is a Google-Fonts substitution. Replace `tokens/fonts.css`
if you have the licensed binaries.)

**Backgrounds.** Solid color or paper, never gradients **except** the dark
scrim over the FIFA 26 pattern in hero cards (a 55%→95% pitch-green linear
gradient that keeps text readable). The pattern itself is the only imagery
on the page — no stock photography, no illustration.

**Borders.** `1px solid var(--line)` (the warm gray `#D9DDD6`) on every card.
A 2px pitch-green border denotes selection (pick options). A 4px host-city
left edge tags a card by round or group.

**Radii.** Cards 12–24px; chips, buttons, badges are fully pill. We avoid
mid-range 4–8px radii except on group letter tiles. The pill bias is part
of the "every control is round, every surface is soft" rhythm.

**Shadows.** Cards stay grounded. `shadow-xs` (a 1px lift) on most rows;
`shadow-sm/md` on raised panels; `shadow-lg` reserved for the landing hero.
Floating "bubble" shadows are avoided entirely. The gold ring
(`shadow-ring-gold`) marks the leader row.

**Transparency / blur.** Used only on (a) the sticky tab strip
(`rgba(255,255,255,0.92)` + `backdrop-filter: blur(10px)`), and (b) the
glass metric chip inside the pool hero. Everywhere else, opaque.

**Motion.** Snappy, no bounce. `dur-1: 80ms` for press feedback (scale
`0.97`), `dur-2: 140ms` for hover, `dur-3: 220ms` for content swaps. Easing
is `cubic-bezier(0.2, 0, 0, 1)` (standard) almost everywhere. Pick
selectors auto-advance after 220ms — long enough to read the green flash,
short enough not to feel like a wait. Loading spinners use the standard
0.7s `spin` keyframe.

**Hover.** Filled buttons darken to a sibling color (`pitch` → `pitch-dark`,
`gold` → `gold-dark`). Outline/ghost buttons swap to `surface-sunk`.
Pickable rows get `surface-sunk` + the green border.

**Press.** Always a `scale(0.97)` transform on the 80ms timing, applied to
buttons and pick options. Never a color flash — the scale is the feedback.

**Layout rules.** Hit targets ≥44px in any pickable surface. The bottom
two-thirds of the viewport always contains the primary CTA (Lock in,
Make a pick, Send). The top third is reserved for context (which match,
what round, who's leading).

**Imagery vibe.** Saturated, geometric, never moody. The official pattern
is the only photo-real asset — and only when overlaid by a dark scrim.

---

## Iconography

The Bracketeer codebase ships exactly one SVG icon (`public/icon.svg`) —
the bracket-tree logomark we've copied to `assets/bracket-icon.svg`.
There is no in-product icon font, no Lucide/Heroicons pull. The product
expresses itself through type, color, and a small set of real photographic
assets rather than icon fonts.

* **Country flags** — real SVGs (not emoji) served from `flagcdn.com` via
  the `<Flag code="BRA" />` component. The 48-team `TEAM_TO_ISO2` map
  lives in `components/bracket/Flag.jsx`; subdivisions (`gb-sct`,
  `gb-eng`) cover Scotland and England. Self-host the SVGs if you need
  offline-safe builds — pass a `src` prop to override the CDN URL.
* **Medals** — `🥇🥈🥉` glyphs on the top-3 leaderboard rows. The only
  emoji we use in product chrome.
* **Status dots** — CSS-only `box-shadow` pulse on the live badge; no
  iconography needed.
* **Symbols** — ASCII arrows (`→`, `←`, `▲`), middle dots (`·`), and the
  occasional `×` close glyph carry the rest of the work. No icon library
  is required to extend the system.
* **Host-city patterns** — `tokens/patterns.css` ships 16 CSS-only motifs
  (`data-pattern="houston"`, `"los-angeles"`, etc.) — chevrons, waves,
  pinstripes, mountain peaks, etc. They are **always subtle** (8–14%
  opacity, set via `--pattern-opacity`) and layered as
  `position: absolute; inset: 0` behind a solid surface — never as the
  foreground. Color follows `currentColor`, so consumers tint with the
  corresponding `--city-*` token.

If a consuming surface needs a richer icon set, link **Lucide** from CDN —
its stroke weight (1.5px) and rounded corners match Bracketeer's
geometry better than Heroicons or Material. Flag this substitution
explicitly when you do.

---

## Designing with this system

1. Link `styles.css` once. Don't override tokens; consume the semantic
   aliases (`--text-body`, `--surface-card`, `--accent-gold`).
2. Reach for components before HTML. `<MatchCard>`, `<LeaderboardRow>`,
   `<PoolHero>`, `<PickSelector>` together cover ~80% of any
   bracket-pool surface.
3. Use the host-city palette as *accent*, not surface. A whole green
   page with one magenta avatar reads as branded; a magenta page
   with green text reads as a different product.
4. Mobile is the design — desktop is the second-class citizen. The 480px
   column is the canvas; 720+ widths can add a side rail at most.
5. The thumb zone (bottom two-thirds) belongs to the user's next action.
   Never put primary CTAs in the top header.

---

## Components

| Group   | Component        | What it is                                               |
|---------|------------------|----------------------------------------------------------|
| core    | `Button`         | Pitch / gold / secondary / ghost / danger pill button    |
| core    | `Badge`          | Live / gold / positive / warning / brand status pills    |
| core    | `Input`          | Default + pill (chat-composer) text input                |
| core    | `Tabs`           | Sticky in-app pill tabstrip (also underline variant)     |
| core    | `Card`           | Flat / raised / brand / sunk / dashed surface            |
| core    | `ChatBubble`     | Pool-chat message bubble (mine / theirs)                 |
| bracket | `GroupChip`      | Letter tile A–L, colored by host-city                    |
| bracket | `Flag`           | Real SVG country flag (flagcdn.com)                      |
| bracket | `TeamRow`        | One side of a match — name, code, flag, score            |
| bracket | `MatchCard`      | Match panel with live/final pill + optional pick state   |
| bracket | `PickSelector`   | Single-tap winner selector (two big options)             |
| bracket | `LeaderboardRow` | Pool leaderboard row with breakdown chips                |
| bracket | `PoolHero`       | The pitch-green header on every pool screen              |
| bracket | `BracketTree`    | Full 5-round desktop knockout tree (≥1280px)             |

Each component lives in its own directory with `<Name>.jsx`, `<Name>.d.ts`,
`<Name>.prompt.md`, and a sibling card HTML.

## UI kit

`ui_kits/bracketeer/` recreates the live Bracketeer app — landing,
pool view (leaderboard / live & next / groups / chat), the picks
wizard, **and the desktop bracket tree** — using the components above.
Open `ui_kits/bracketeer/index.html` for the interactive flow.

## Open questions / next steps

* **Brand fonts** — Archivo Black is a stand-in for the proprietary
  "FIFA Sport" wordmark family. If the licensed fonts are available,
  drop the binaries into `assets/fonts/` and update `tokens/fonts.css`.
* **Group ↔ host-city mapping** — the A–L → city mapping in `GroupChip`
  is illustrative, not official. Confirm with the user (FIFA does not
  pre-publish a group ↔ host-city assignment).
* **Flag SVGs** — currently CDN-served from flagcdn.com. For
  offline-safe builds, drop SVGs in `assets/flags/` and pass a `src`
  prop to the `<Flag>` component.
