# Bracketeer — Session Handoff

Working notes for continuing the build. Read `CLAUDE.md` first for architecture + commands.
Full design rationale: `/home/dom/.claude/plans/kind-wiggling-ritchie.md`.

## Context

Racing a **World Cup 2026 MVP** for a friend group; **kickoff 2026-06-11**. The friends already
made picks in `WorldCup2026Bracket.html`, exported as CSV — so the MVP **imports** picks rather
than rebuilding the selection UI. Confirmed product decisions: race the MVP now → generalize to a
multi-tenant platform later; live scores via sports API **with manual admin override as the
reliable core**; responsive web / installable PWA; full accounts (Google OAuth + email magic-link).

If we slip, the original HTML still works (batch-scores CSVs in-browser) — nobody is blocked at
kickoff. Say so to the user rather than treating the date as existential.

## Status

**Done & verified (build green, 31 unit tests + tsc + lint clean, backend smoke 9/9 on live DB):**
- Scaffold (Next 16 + Prisma 7 + Postgres), conventions from `carecover`.
- Scoring engine ported byte-for-byte + golden tests (2000 randomized parity checks). **GATE — green.**
- Prisma schema (multi-tenant-ready) + WC2026 seed (48 teams, 104 matches), live in dev DB.
- Pick-row mapping, CSV import service, pool recompute service — proven end-to-end on a live DB.
- 10 synthetic CSV fixtures (`fixtures/csv/`, incl. no-BOM/LF + partial). Pool `FIXTUR` is seeded.
- Mobile-first leaderboard page (`/pool/[code]`) + PWA manifest.
- **Auth.js v5** (`auth.ts`): PrismaAdapter, Google (when `AUTH_GOOGLE_ID/SECRET` set) + Nodemailer
  magic-link (logs link in dev, throws in prod when `EMAIL_SERVER` unset). DB sessions; no
  middleware/proxy guard — `auth()` runs inside handlers/server components. `/signin` page,
  `/api/auth/[...nextauth]`. On sign-in, `claimEntriesForUser` binds `claimEmail` entries + adds a
  Membership (`lib/auth/claim.ts`).
- **Bracket resolution engine** (`lib/pool/bracket.ts`, TDD): `resolveBracket(results)` reuses
  `resolve.ts` greedy thirds; `validateKnockoutWinner` rejects teams not in a (resolved) match.
- **Import endpoint** `POST /api/pool/[id]/import` (owner/admin; JSON `{csv}` or multipart files,
  size/count-bounded) → import → recompute → notify.
- **Admin result entry** (`lib/pool/results.ts` + `/api/admin/{results/[matchNo],standings,awards}`
  + `/admin` UI): writes `officialResults` (the scoring source of truth), mirrors `Result` rows
  (MANUAL beats API), validates knockout winners, rejects contradictory standings, recomputes all
  pools. Tournament-admin gate = `ADMIN_EMAILS` allow-list (`isAdminEmail`; open ONLY in real
  `development`, fail-closed everywhere else).
- **Bracket view + group standings** on the pool page (`Bracket.tsx`, `bracket-view.ts`).
- **Chat** (`lib/pool/chat.ts` + `/api/pool/[id]/chat`, members only) with a client `Chat.tsx`.
- **SSE realtime** `GET /api/pool/[id]/stream` (dedicated `pg` LISTEN `pool_events`, per-pool
  filter, connection-capped) + `usePoolStream`/`PoolRealtime` client with 15s poll fallback.
  Producers call `notifyPool` (`lib/realtime/notify.ts`).
- **Sports cron** `POST /api/cron/poll-scores` (timing-safe `CRON_SECRET`), `lib/sports/*`,
  `scripts/cron.mjs`. Empty fixture maps until the real draw → safe no-op; manual stays primary.
- **Deploy configs**: `railway.json` (preDeploy `prisma migrate deploy`) + `railway.cron.json`.

**Remaining — only the live deploy + optional polish:**

### 1. Deploy to Railway
- Provision Railway web + cron services + Postgres; `railway.json` / `railway.cron.json` are ready.
- Set env: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_BASE_URL`, **`ADMIN_EMAILS`**
  (required in prod — admin is fail-closed without it), and optionally `AUTH_GOOGLE_ID/SECRET`,
  `EMAIL_SERVER`/`EMAIL_FROM`, `SPORTS_API_KEY`. `AUTH_URL` only if behind a proxy that needs it.

### 2. Sports auto-polling (optional; manual entry works today)
- Populate `lib/sports/fixtures-map.ts` (`EXTERNAL_TO_MATCHNO`, `EXTERNAL_TEAM_CODES`) once the
  2026 draw + provider fixture ids exist. API-Football (`league=1, season=2026`); a ~€20–69
  one-month paid plan is likely (free tiers delay/rate-cap). Knockouts map **slots, not teams**.

### 3. Optional hardening (deferred for the MVP, flagged in review)
- Replace the per-connection SSE `pg` Client with one shared LISTEN client + in-process fan-out
  (currently capped at 100 concurrent streams).
- Per-user rate limits on chat/import; use `Membership.displayName` for chat author names.

**Verify locally** (sandbox blocks localhost HTTP — use build + tsx, see `CLAUDE.md`):
`env $ENV npm run build` · `npx vitest run` · `npm run typecheck` ·
`env $ENV npx tsx scripts/verify-backend.ts` (import→standings→knockout propagation→reject→
recompute→claim, all against the dev DB).

## Open inputs from the user (don't block on these — synthetic data covers dev)
- Real friend CSVs (final golden sanity check; generator already produces equivalent data).
- Confirm OK with the ~€20–69 sports-API cost, or ship manual-only first.
- Google OAuth credentials + a Railway/Postgres target for deploy.
- A real app name (working name is "bracketeer").

## Gotchas
- **`.env` is hook-protected** — pass env inline (see `CLAUDE.md`). The dev DB lives in the sousiq
  pgvector container.
- Run **`npx prisma generate` after every schema change** — `migrate dev`'s auto-regen is
  unreliable with the custom client output path here (caused a stale-client error once).
- **Sandbox blocks localhost HTTP** — verify UI with `npm run build`, backend with the tsx scripts.
- Attribution is disabled globally — no `Co-Authored-By` footer on commits.
