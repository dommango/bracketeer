# scripts/

Operational tooling, local dev helpers, and manual verification scripts. Most are run with
`tsx` and need the dev env — use the inline-env prefix from
[`CLAUDE.md`](../CLAUDE.md#commands), e.g.:

```bash
env DATABASE_URL=… AUTH_SECRET=… CRON_SECRET=… APP_BASE_URL=… npx tsx scripts/<name>.ts
```

The categories below describe **intent** — what's load-bearing vs. what's historical — since
that isn't obvious from filenames alone.

## Operational (production)

- `cron.mjs` — the scheduled job runner used by the Railway cron service (`npm run cron`).

## Local data & demo

Safe to run against a local DB to get something on screen.

- `seed-hessfest.ts` — seed the real HessFest pool from `prisma/seed-data/` (gitignored; PII).
- `gen-fixtures.ts` / `import-fixtures.ts` — generate synthetic contestant CSVs, then import them
  and print a leaderboard (exercises the full CSV import path).
- `demo.ts` — minimal end-to-end backend smoke (pool → entries → score → leaderboard);
  wired up as `npm run db:demo`.
- `demo-provisional.ts`, `md3-demo-seed.ts` — focused demo seeds for provisional standings / the
  Match-Day-3 game.
- `probe-api.ts` — one-shot connectivity probe for the external sports/odds APIs.

## Manual verification & smoke

Run-and-eyeball regression checks for specific subsystems (not part of `vitest`). Useful when
changing the area each one targets; each prints a pass/fail summary.

- `verify-backend.ts`, `verify-features.ts`, `verify-md3-challenge.ts`, `verify-multi-bracket.ts`,
  `verify-odds.ts`, `verify-positional-fill.ts`, `verify-qa-fixes.ts`, `verify-result-guard.ts`,
  `verify-tier4.ts`, `verify-venues.ts`
- `multi-bracket-smoke.ts`, `prize-smoke.ts`, `solo-smoke.ts`

## One-off / historical

Completed migrations and data fixes, kept for reference. **Not** meant to be re-run in normal
development.

- `migrate-md3-pools-to-challenge.ts`, `backfill-odds-orientation.ts`, `fix-nick-awards.ts`,
  `qa-seed.ts`, `export-hessfest.ts`
- `gen-fixtures-map.ts`, `generate-fixtures-map.ts` — overlapping fixture-map generators; candidates
  for consolidation.
