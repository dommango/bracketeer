# Contributing to Bracketeer

Thanks for taking a look. This guide covers the few things that aren't obvious from the
code — most importantly, the one invariant the whole project is built around.

## Local setup

See [README.md → Getting started](./README.md#getting-started). The app runs fully keyless;
you only need Node 22.x and Postgres. `npm run db:demo` loads a sample pool so you have data
to look at.

## The one rule: scoring parity is sacred

Scoring must stay **byte-for-byte identical** to the original in-browser pick tool
(`WorldCup2026Bracket.html`). Real people made real picks in that tool; their standings must
never shift because of a code change.

- `lib/scoring/` is the ported, load-bearing engine. Treat it as such.
- `lib/scoring/score.test.ts` holds a **verbatim copy of the original `scorePicks` as a
  reference oracle** and checks the TS port against it across 2000 randomized inputs.
- **Any change touching scoring must keep that test green:**

  ```bash
  npx vitest run lib/scoring/score.test.ts
  ```

If you can't keep the oracle green, the change is wrong — not the test.

## Additive and non-breaking by rule

The product is mid-pivot (one WC2026 pool → a multi-tenant platform), and that work is
**additive**: existing pools and scoring parity must keep working unchanged.

- Schema changes must be backwards-compatible — existing `Pool`/`Entry`/`Pick` rows must keep
  scoring exactly as before.
- New game formats are added as `GameModule`s (`lib/games/`), not as `if (format === …)` forks.
- New external integrations follow the existing pattern: SDK-free (`fetch` / `node:crypto`),
  behind a single env gate in `lib/env.ts`, no-op cleanly when unset.

## Before you push

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (keep it at zero warnings)
npx vitest run         # full unit suite
npm run build          # compiles/validates every route (needs DATABASE_URL + the two secrets)
```

New behavior needs tests. Business logic is unit-tested under `lib/`; user flows use Playwright
(`npm run test:e2e`). The `lib/` side is well covered; `app/` routes and components are not —
if you touch a critical flow, add an E2E test.

## Pull requests

- Branch off `main`. Keep PRs focused.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`,
  `docs:`, `test:`, `chore:`, `perf:`, `ci:`).
- Include a short test plan (what you ran, what you verified).

## Conventions

- Files `kebab-case`, components `PascalCase`, functions/vars `camelCase`, constants
  `UPPER_SNAKE_CASE`.
- Prefer many small, focused files (~200–400 lines; 800 is a hard ceiling).
- Immutable data flow — build new objects, don't mutate.
- See [`CLAUDE.md`](./CLAUDE.md) for the full architecture tour (scoring engine, CSV encoding,
  multi-tenant schema, knockout module, realtime, auth).
