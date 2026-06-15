# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

HessFest is a tournament bracket-pool app. It shipped as a **World Cup 2026 MVP** for a friend
group (kickoff 2026-06-11) and is mid-pivot into **Bracketeer**, a multi-tenant platform where
anyone can create and run a pool — HessFest is now one pool/instance. The pivot runs in phases
(platform framing → knockout module → SaaS billing/invites → iOS/PWA/push → launch); see
`handoff.md` for build status and the roadmap plan referenced there. Phase work is **additive
and non-breaking** by rule: existing pools and oracle scoring parity must never change.

## Commands

`.env` is **blocked by the global protect-files hook** — it cannot be written by tooling. For
local dev, either create `.env` yourself (copy `.env.example`) or pass vars inline. The dev
database is a `bracketeer` DB inside the already-running **sousiq pgvector container**
(`localhost:5432`, user `food_cost_user`, pw `food_cost_dev`).

```bash
# Inline env prefix used throughout (DB + the two required secrets):
ENV='DATABASE_URL=postgresql://food_cost_user:food_cost_dev@localhost:5432/bracketeer AUTH_SECRET=dev-only-secret-at-least-32-characters-long CRON_SECRET=dev-cron-secret APP_BASE_URL=http://localhost:3000'

env $ENV npm run dev            # dev server (http://localhost:3000)
env $ENV npm run build          # production build (compiles/validates every route)
npm run typecheck               # tsc --noEmit (no env needed)
npm run lint                    # eslint

npx vitest run                  # all unit tests (no DB needed)
npx vitest run lib/scoring/score.test.ts          # one file
npx vitest run -t "byte compatibility"            # one test by name

env $ENV npm run db:migrate -- --name <name>      # create + apply a migration (prisma migrate dev)
env $ENV npx prisma generate                      # regenerate client after schema edits (REQUIRED — migrate dev's regen is unreliable here)
env $ENV npx tsx prisma/seed.ts                   # seed WC2026 (48 teams, 104 matches; idempotent)

# Verification / demo scripts (all via tsx + inline env):
env $ENV npx tsx scripts/gen-fixtures.ts          # write 10 synthetic contestant CSVs to fixtures/csv/
env $ENV npx tsx scripts/import-fixtures.ts       # import fixtures + print a leaderboard (exercises the full import path)
env $ENV npx tsx scripts/demo.ts                  # minimal end-to-end backend smoke test
```

Note: the sandbox blocks localhost HTTP, so you typically cannot `curl` the dev server here —
verify UI via `npm run build` (eager route compilation) and the backend via the tsx scripts.

## Architecture

The whole app is organized around one non-negotiable invariant: **scoring must stay
byte-for-byte identical to the original `WorldCup2026Bracket.html`** (at
`/mnt/c/Users/domma/Downloads/WorldCup2026Bracket.html`), because contestants' picks were made
in that tool and people's standings must not change. Everything below serves that.

- **`lib/scoring/` — ported engine (treat as load-bearing).** `data.ts` (TEAMS/GROUPS/R32…/FINAL),
  `resolve.ts` (R32 slot resolution), `score.ts` (`scorePicks`), `csv.ts` (parser + serializer).
  - `score.test.ts` holds a **verbatim copy of the original `scorePicks` as a reference oracle**
    and asserts the TS port matches it across 2000 randomized inputs. Any change to scoring must
    keep this green.
  - `resolve.ts` assigns third-place teams by **backtracking over R32 slots in match-id order**,
    ported from the revised tool (`WorldCup2026Bracket Revised.html`). The original greedy
    first-eligible assignment stranded valid pick sets and was deliberately replaced (PR #4).
    Slot resolution affects display/validation only — `scorePicks` never reads it, so scoring
    parity with the oracle is unaffected. Do **not** reintroduce the greedy version or swap in
    FIFA's placement table without re-validating every imported bracket.
  - Point values live in `score.ts`'s `DEFAULT_SCORING` and are mirrored into
    `Tournament.scoringConfig`: group exact 3, partial (wrong-position or correct-3rd) 1, third
    advancer 3, R32 1, R16 2, QF 3, SF 4, Final 5, award 1, **bronze (match 103) not scored**.

- **One CSV row builder is the single source of truth.** `submissionToRows()` in
  `lib/scoring/csv.ts` produces the long-format rows; `submissionToCsv()` serializes them, and
  `lib/pool/picks.ts` maps the same rows to/from DB `Pick` records (then decodes via the CSV
  parser `csvRowsToSubmission`). So **CSV import, CSV export, and DB pick storage all share one
  encoding** — change the schema in one place and all three stay consistent. `Pick` columns
  mirror the CSV columns exactly (`section, category, key, code, teamOrValue`); the CSV
  `category` column carries the group letter / match id (`Group A`, `M73`) and must be preserved.

- **The answer key is `Tournament.officialResults` (a JSON `Results` object).** Scoring runs each
  entry's picks against it — mirroring the HTML's single `RESULTS` object. `Match`/`Result` rows
  exist for live per-match scores (display + sports-API feeds) and are **not** the scoring source
  of truth; admin/manual entry and API propagation write into `officialResults`.

- **Scoring/leaderboard flow:** `lib/pool/import.ts` persists a parsed submission as an `Entry` +
  `Pick` rows (idempotent by `claimEmail`/label). `lib/pool/scoring.ts` `recomputePool()` scores
  every entry vs `officialResults` using `scoringConfig`, caches a `ScoreBreakdown` per entry, and
  returns a ranked leaderboard. UI reads the cache via `lib/pool/queries.ts`.

- **Multi-tenant by construction.** Nothing is WorldCup-hardcoded in the schema: a `Tournament`
  carries its own structure + scoring config; WC2026 is one seeded row. Internal match numbering
  (used as the scoring key): group 1–72, R32 73–88, R16 89–96, QF 97–100, SF 101–102, bronze 103,
  final 104.

- **A `Pool` has two orthogonal, additive dimensions** (the HessFest pool is the default of
  both, so it's unaffected by either): `format` (`FULL_BRACKET` | `KNOCKOUT`) and `tier`
  (`FREE` | `PREMIUM`). KNOCKOUT pools reuse the same `Pick`/`Entry` storage and knockout
  scoring but enter only winners-from-the-real-qualifiers (`lib/pool/knockout.ts` seeds the
  bracket from the official R32) and **lock at the R32 kickoff** (Match-73's `scheduledAt`), not
  the group kickoff — distinct from full-bracket lock in `lib/pool/lock.ts`. `tier` gates pool
  size via the pure `lib/billing/entitlements.ts` (`FREE_MEMBER_CAP`, PREMIUM uncapped), enforced
  in `joinPool`/`acceptInvite`.

- **Optional integrations degrade gracefully behind one env gate each.** `lib/env.ts` validates
  `process.env` once (Zod, throws on missing required vars) and exports a boolean per integration:
  `googleEnabled`, `emailEnabled`, `sportsApiEnabled`, `oddsApiEnabled`, `giphyEnabled`,
  `stripeEnabled`, `pushEnabled`. Every feature that needs secrets checks its flag and no-ops
  cleanly when unset, so the app builds and runs keyless. **New integrations follow this pattern.**

- **External integrations are implemented SDK-free** (deliberate — keeps `npm install` light and
  the build green without keys). Stripe billing (`lib/billing/`) and APNs push (`lib/push/`) both
  use `fetch`/`node:http2` + `node:crypto` instead of a vendor SDK, each split into a **pure,
  env-free half that's unit-tested** (signature/JWT/encoding — e.g. `stripe-webhook.ts`,
  `apns-jwt.ts`) and an impure half bound to `env`/DB/network (verified via build + a tsx DB
  smoke, since the sandbox can't reach the live services).

- **Realtime + push fan-out share the result event.** Producers call `notifyPool(poolId, type)`
  (`lib/realtime/notify.ts`) which emits Postgres `LISTEN/NOTIFY`; one process-wide `RealtimeHub`
  (`hub.ts`) forwards to all open SSE streams (`/api/pool/[id]/stream`), with client polling as a
  self-healing fallback. On knockout results, `recomputeTournamentPools` additionally fires
  best-effort native push (`lib/push/send.ts`) on the same event. Both layers are best-effort: a
  notify/push failure never breaks the operation that triggered it.

- **Authorization lives in route handlers/server components, not middleware** (there is no
  `middleware.ts`). `lib/pool/access.ts` resolves the Auth.js session (`getSessionUser`, memoized
  per request via `react cache`) and the caller's membership: `getPoolAccess` / `canManagePool`
  for pool-scoped access, `getTournamentAdmin` (+ `isAdminEmail` in `lib/env.ts`) for answer-key
  writes. Admin tools fail **closed** outside local dev when `ADMIN_EMAILS` is unset.

- **Infra conventions are copied from the sibling `carecover` project**
  (`/home/dom/projects/carecover`): Prisma 7 + `@prisma/adapter-pg` (`lib/db.ts`), the Zod env
  pattern above, and a Railway web-service + cron-service deploy with a `CRON_SECRET`-guarded
  `/api/cron/*` route (`scripts/cron.mjs`, `railway*.json` — to be added). The iOS app is a
  **Capacitor** wrap of the hosted web app; the web bundle stays decoupled by talking to the
  native runtime only through the injected `window.Capacitor` global (`lib/native/bridge.ts`),
  never importing `@capacitor/*` (those install on the Mac build only; `capacitor.config.ts` is
  excluded from `tsc`/eslint).
