# Bracketeer

A multi-tenant tournament bracket-pool platform. Create a pool, invite friends, make
bracket picks, and watch a live leaderboard update as real results come in. It began life as
a World Cup 2026 prediction game for a friend group and is generalizing into a platform where
anyone can run a pool.

> **Note:** the npm package is still named `hessfest` (the original pool); the product name is
> Bracketeer.

## Features

- **Full-bracket and knockout pools** — predict the whole tournament, or just the knockout
  rounds once the field is set.
- **Live scoring & leaderboards** — entries are scored against an official answer key with a
  cached, ranked leaderboard; live/provisional points update as group and knockout matches play
  out.
- **Home group-stage overlay** — see your bracket picks overlaid on the live group standings,
  with a per-group breakdown of the points each pick is earning.
- **Solo brackets + a global master tournament** — build a bracket without a pool and opt into a
  shared global leaderboard.
- **Real-time updates** — Server-Sent Events via Postgres `LISTEN/NOTIFY`, with polling fallback.
- **Optional integrations, all behind env gates** — Google / magic-link auth, live scores &
  odds, Stripe billing, native push, GIPHY. Everything degrades gracefully and the app builds
  and runs with no keys configured.
- **CSV import/export** of picks, sharing one encoding with DB storage.

## Tech stack

Next.js (App Router) · TypeScript · Prisma + PostgreSQL · Auth.js v5 · TailwindCSS ·
Vitest · Playwright · Capacitor (iOS wrap). External integrations are implemented SDK-free
(`fetch` / `node:crypto`) to keep installs light and the build green without keys.

## Getting started

**Prerequisites:** Node 22.x, a PostgreSQL database.

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env        # then edit values (DATABASE_URL, AUTH_SECRET, CRON_SECRET, APP_BASE_URL)

# 3. Set up the database
npx prisma migrate deploy   # apply migrations
npx prisma generate         # generate the client
npx tsx prisma/seed.ts      # seed the World Cup 2026 tournament (48 teams, 104 matches)

# 4. Run
npm run dev                 # http://localhost:3000
```

Required env vars: `DATABASE_URL`, `AUTH_SECRET` (32+ chars), `CRON_SECRET`, `APP_BASE_URL`.
All third-party integrations are optional — see `lib/env.ts` for the full list and the boolean
flag each one exposes.

## Common commands

```bash
npm run dev          # dev server
npm run build        # production build (compiles/validates every route)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npx vitest run       # unit tests (no DB needed)
npm run test:e2e     # Playwright E2E
```

## Architecture

The codebase is organized around one invariant: **scoring stays byte-for-byte identical to the
original pick tool**, so existing standings never change. `lib/scoring/` holds the ported,
load-bearing engine (with a golden oracle test running 2000 randomized parity checks), and the
schema is multi-tenant by construction. See [`CLAUDE.md`](./CLAUDE.md) for a detailed tour of the
architecture and conventions.

## License

[MIT](./LICENSE)
