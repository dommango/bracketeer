// Predictions poller: pulls API-Football /predictions (win %, advice, form, h2h)
// for upcoming fixtures and upserts MatchPrediction. Each prediction is ONE call
// per fixture, so this is tightly bounded — only fixtures kicking off within the
// window, capped — and runs on a slow cron cadence, well off the every-5-min path.
// Safe no-op when SPORTS_API_KEY is not configured.

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchPrediction } from "@/lib/sports/client";
import { parsePrediction, reorientPrediction } from "@/lib/sports/predictions-parse";
import { normalizeTeam } from "@/lib/odds/map";

export interface PredictionsPollSummary {
  considered: number;
  skipped: number;
  fetched: number;
  upserted: number;
}

// Only predict fixtures kicking off within this window (predictions firm up close
// to kickoff) and cap the number per run — both guard the API credit budget.
const WINDOW_AHEAD_MS = 48 * 60 * 60 * 1000;
const WINDOW_BEHIND_MS = 3 * 60 * 60 * 1000; // include in-progress / just-kicked-off
const MAX_PER_RUN = 10;
// A fixture far from kickoff that already has a recent prediction is skipped — its
// numbers barely move, so re-fetching hourly wastes credits. Within NEAR_KO it
// refreshes every run (predictions firm up as teams/news settle).
const NEAR_KO_MS = 6 * 60 * 60 * 1000;
const FRESH_MS = 6 * 60 * 60 * 1000;

// `force` bypasses the freshness-skip (re-fetch every in-window fixture now) and
// `max` raises the per-run cap — for a manual one-off refresh of the whole knockout
// slate (16 R32 fixtures > the default cap). The cron path calls with no opts, so
// its budgeted cadence is unchanged.
export async function pollPredictions(
  now: Date = new Date(),
  opts: { force?: boolean; max?: number } = {},
): Promise<PredictionsPollSummary> {
  if (!sportsApiEnabled) return { considered: 0, skipped: 0, fetched: 0, upserted: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { considered: 0, skipped: 0, fetched: 0, upserted: 0 };

  // Upcoming fixtures with a known provider id and a scheduled kickoff in-window.
  const matches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      externalRef: { not: null },
      scheduledAt: {
        gte: new Date(now.getTime() - WINDOW_BEHIND_MS),
        lte: new Date(now.getTime() + WINDOW_AHEAD_MS),
      },
    },
    select: {
      id: true,
      externalRef: true,
      scheduledAt: true,
      // Our designated home for the fixture — for GROUP matches the slot ref is a
      // real team code; a played match's Result row takes precedence. (Knockout
      // slot refs are placeholders like "W73", not codes — see targetHome below.)
      roundCode: true,
      homeSlotRef: true,
      result: { select: { homeTeamCode: true } },
      prediction: { select: { fetchedAt: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: opts.max ?? MAX_PER_RUN,
  });

  let skipped = 0;
  let fetched = 0;
  let upserted = 0;
  for (const m of matches) {
    const fixtureId = Number(m.externalRef);
    if (!Number.isFinite(fixtureId)) continue;

    // Skip far-from-kickoff fixtures whose prediction is still fresh (credit guard).
    const msToKO = (m.scheduledAt?.getTime() ?? 0) - now.getTime();
    const lastFetched = m.prediction?.fetchedAt?.getTime() ?? 0;
    if (!opts.force && m.prediction && msToKO > NEAR_KO_MS && now.getTime() - lastFetched < FRESH_MS) {
      skipped++;
      continue;
    }

    try {
      const resp = await fetchPrediction(fixtureId);
      fetched++;
      if (!resp) continue;
      // Reorient to our home side (the provider's home is arbitrary at neutral WC
      // venues). targetHome is a 3-letter code for group fixtures; apiHome resolves
      // the provider's home name to a code — null on either side leaves orientation
      // as-is (no wrong guess).
      const apiHome = normalizeTeam(resp.teams?.home?.name ?? "");
      // A played match's Result home wins; else the GROUP slot ref (a real code).
      // Knockout slot refs ("W73") aren't codes, so leave those as null → no swap.
      const targetHome =
        m.result?.homeTeamCode ?? (m.roundCode === "GROUP" ? m.homeSlotRef : null);
      const ins = reorientPrediction(parsePrediction(resp), apiHome, targetHome);
      const data = {
        homePercent: ins.homePercent,
        drawPercent: ins.drawPercent,
        awayPercent: ins.awayPercent,
        advice: ins.advice,
        homeForm: ins.homeForm,
        awayForm: ins.awayForm,
        // DbNull (not undefined) so a later poll that loses h2h clears the stale summary.
        h2h: ins.h2h ? (ins.h2h as object) : Prisma.DbNull,
        raw: resp as object,
        fetchedAt: now,
      };
      await prisma.matchPrediction.upsert({
        where: { matchId: m.id },
        update: data,
        create: { matchId: m.id, ...data },
      });
      upserted++;
    } catch (err) {
      // One fixture failing must not abort the rest of the batch.
      console.error(`predictions: fixture ${fixtureId} failed:`, err);
    }
  }

  return { considered: matches.length, skipped, fetched, upserted };
}
