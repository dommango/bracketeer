# Bracketeer UI Kit

Three core screens of the **Bracketeer** app — the World Cup 2026 pool MVP — recreated to match the live Next.js codebase (`/bracketeer`).

## Screens

| Screen        | What it shows                                                                  |
|---------------|--------------------------------------------------------------------------------|
| `Landing.jsx` | Marketing splash + join-code entry, mirrored from `app/page.tsx`.              |
| `Pool.jsx`    | The main pool view — hero, sticky tabs, leaderboard, bracket, groups, chat.    |
| `Picks.jsx`   | The pick-entry wizard — single-tap selectors, round-by-round paging, autosave. |

`index.html` is the interactive entry: it boots into the landing screen, accepts a join code, transitions to the pool view, lets you switch tabs, and the **Make a pick** action opens the picks wizard.

## Visual / interaction model

* Pitch-green hero panel with the official FIFA 26 pattern behind a gradient scrim.
* Mobile-first single column (max 480px); tabs sticky to top.
* Single-tap pick selectors throughout — never dropdowns.
* All interactive controls are ≥44px tall and live in the bottom 2/3 of the screen (thumb-zone).

This kit replicates the screens that currently exist in the codebase; it does not invent flows that aren't there.
