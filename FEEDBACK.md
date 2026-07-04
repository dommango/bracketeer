# Feedback → Notion Contract

This app mirrors in-app feedback/bug reports into the shared central Notion database
**"📥 App Feedback"**. This document is the canonical contract that both the app code and
any triage agent must follow. Keep it in sync across all consuming apps.

- **Central database:** `📥 App Feedback`
- **Database ID:** `c153f1e7-b65d-49d2-a2d8-5e57d1f22b70`
- **Data source:** `collection://5ccf696e-e7bf-42ba-ae23-5e12d4d35b2f`
- **Env var:** `NOTION_FEEDBACK_DB_ID` (this ID in dev; prod repointed during supervised cutover)

## Schema

| Property | Type | Notes |
|---|---|---|
| Title | title | `{emoji} {title}` — 🐛 Bug / 💬 Feedback / ✨ Request |
| App | select | SousIQ, HessFest, CareCover (add one option per new app) |
| Type | select | Bug, Feedback, Request |
| Status | select | New, Triaged, In progress, Done, Won't fix, Duplicate |
| Priority | select | Critical, High, Medium, Low |
| Environment | select | Production, Development |
| App Row ID | rich_text | Postgres UUID/cuid — **idempotency key, write-once** |
| Page URL | url | page the report was filed from |
| User Email | email | from auth, if present |
| Browser | rich_text | userAgent, truncated |
| Screenshot | files | external URLs to the app's public screenshot endpoint |
| Fix Link | url | PR/commit — agent/human writable |
| Submitted | created_time | auto |
| Ticket ID | unique_id (`FB`) | auto |

Page body: description paragraph + inline image blocks for screenshots.

## Property write-ownership

- **App-owned (never edited by agents):** Title, App, App Row ID, Page URL, User Email,
  Browser, Screenshot, Environment, and the initial Type.
- **Agent-writable:** Status, Priority, Fix Link, and comments.

## Status transitions

```
New → Triaged → In progress → Done
New | Triaged → Won't fix | Duplicate
```

Never move a row backwards out of In progress/Done during automated triage.

## Dedupe rule

Same **App** + near-identical Title within **≤14 days** → the newer row is set to
**Duplicate** with a comment linking to the original. Never archive/delete the original.

## Idempotency / reconciler rule

- The app writes `notion_page_id` (SousIQ) / `notionPageId` (HessFest) immediately after
  creating a Notion page; a NULL synced-at timestamp is the outbox flag.
- The reconciler **queries Notion by `App Row ID` before creating** a page, so a
  crash-after-create window never produces a duplicate.
- Sync attempts are capped at 5; the last error is retained; persistent failure surfaces
  via Sentry/Railway logs — feedback is never silently lost.

## Per-app specifics

**App value:** `HessFest`

**Env vars** (both required to enable the mirror; missing either keeps feedback DB-only —
see `notionEnabled` in `lib/env.ts`):
- `NOTION_API_KEY` — Notion integration token (the integration must be shared with the
  central "📥 App Feedback" database).
- `NOTION_FEEDBACK_DB_ID` — the central database ID above (`c153f1e7-…`). Repointed on
  Railway during the supervised cutover; dev/staging may use a scratch DB.

**Data model** (`prisma/schema.prisma`, `model Feedback`):
- `type` enum `FeedbackType { BUG, IDEA, OTHER }` → central `Type`: **BUG→Bug, IDEA→Request,
  OTHER→Feedback**.
- Outbox columns: `notionPageId`, `notionSyncedAt` (NULL = unsynced, the outbox flag),
  `notionSyncAttempts` (capped at 5), `notionLastError`. Also `notionUrl` (back-link).

**Sync path:**
- On submit, `lib/feedback/submit.ts` writes the row then runs the Notion create **out of
  the request path** via Next `after()` (see `lib/notion/feedback-sync.ts`, which delegates
  the pure schema mapping to `lib/notion/feedback-payload.ts`).
- **Reconciler:** `lib/notion/feedback-reconcile.ts`, exposed at cron route
  **`/api/cron/reconcile-feedback`** (CRON_SECRET-guarded), invoked **every 30 min** by the
  always-on worker `scripts/cron.mjs`. It queries Notion by `App Row ID` before creating.

**Screenshot endpoint:** `GET /api/feedback/screenshots/{id}/{index}` — public (so Notion's
servers can fetch the external file URLs), raster-only allowlist (`image/png`, `image/jpeg`,
`image/webp` — no SVG), `nosniff` + locked-down CSP. `{index}` is `0..2`.
