---
name: bracketeer-fifa26-design
description: Use this skill to generate well-branded interfaces and assets for Bracketeer, a tournament bracket-pool app whose first tenant is the FIFA World Cup 2026. Contains essential design guidelines, the pitch-green + gold brand spine, the official FIFA 26 host-city accent palette, typography, fonts, the official 26 brand pattern + emblem assets, and ready-to-use React UI primitives (PoolHero, MatchCard, PickSelector, LeaderboardRow, etc.) for prototyping pool screens, picks flows, and admin tools.
user-invocable: true
---

Read the `readme.md` file at the root of this skill — it is the canonical
brand and content guide. Then explore the other available files:

- `styles.css` — the single CSS entry point. Link it from any HTML you produce.
- `tokens/` — colors, typography, spacing, motion, the FIFA 26 host-city palette.
- `components/` — React primitives (`.jsx` + `.d.ts` + `.prompt.md`). Read the prompt files for usage snippets.
- `ui_kits/bracketeer/` — a fully-interactive recreation of the Landing → Pool → Picks flow. Good reference for screen composition.
- `assets/` — the FIFA 26 emblem, official "26" background pattern, host-city swatch sheet, bracket icon.
- `guidelines/` — small specimen cards demonstrating each foundation token.

If you are creating visual artifacts (mocks, throwaway prototypes, decks,
slides), copy assets from `assets/` into your output folder and produce
static HTML files for the user to view. Link `styles.css` for tokens; lift
component implementations from `components/*/Button.jsx` etc. if you need
React behavior in a standalone HTML file (see `ui_kits/bracketeer/components.jsx`
for an inline-bundled example).

If you are working on production code (the Bracketeer Next.js codebase),
read the brand rules in `readme.md` and treat the tokens and component
APIs here as the spec — match copywriting tone, the pitch-green spine,
the host-city accent system, and the thumb-zone ergonomics described in
the Visual Foundations section.

If the user invokes this skill without any other guidance, ask them what
they want to build or design — a new pool screen, a marketing page, a
deck for the pool's launch, an admin tool, etc. — ask focused follow-up
questions about audience, fidelity, and which surfaces matter, then act
as an expert designer who outputs HTML artifacts or production code,
depending on the need.

Non-negotiables for any design produced through this skill:

- Pitch green (#0B6B3A) is the brand. Gold (#F4C542) is the winning state.
- Host-city accents are **accents**, never page backgrounds.
- Hit targets ≥44px. Primary CTAs in the bottom two-thirds of the viewport.
- Single-tap pick selection; no dropdowns for winner choices.
- Sentence case throughout. Tabular monospace numerics. Mobile-first 480px column.
- The FIFA 26 brand pattern only appears under a dark scrim — never raw.

Flag any substitution to the user before shipping: especially the
Archivo-Black-for-FIFA-Sport font swap, the illustrative A–L to host-city
mapping in `GroupChip`, and any reach for a third-party icon library.
