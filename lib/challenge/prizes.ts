// Bracketeer-sponsored prize resolution (Phase 1: detect → record → notify →
// manual fulfill). When a public challenge completes, record one PrizeAward for
// its rank-1 eligible entry and best-effort notify the winner. No money moves in
// code — an admin sends the gift card by hand (status PENDING → SENT). Idempotent
// via the PrizeAward (challenge, tournament) unique constraint: re-running after
// an award exists is a no-op.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getChallengeLeaderboard, getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import { PRIZES, computePrizeAmount, type ChallengeFormat } from "@/lib/challenge/prizes-config";
import { formatPrize } from "@/lib/challenge/format-prize";
import { GAME_CATALOG } from "@/lib/pool/games";
import { selectPrizeWinner } from "@/lib/challenge/prizes-select";
import { sendPrizeEmail } from "@/lib/email/send";
import { sendPushToUser } from "@/lib/push/send";
import type { LeaderboardRow } from "@/lib/pool/scoring";

// Whether the knockout challenge has finished: the Final (match 104) is FINAL.
async function isKnockoutComplete(tournamentId: string): Promise<boolean> {
  const final = await prisma.result.findFirst({
    where: { status: "FINAL", match: { tournamentId, matchNo: 104 } },
    select: { id: true },
  });
  return Boolean(final);
}

// Whether the MD3 challenge has finished: all 24 round-3 fixtures are FINAL.
async function isMd3Complete(tournamentId: string): Promise<boolean> {
  const finals = await prisma.result.count({
    where: {
      status: "FINAL",
      match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } },
    },
  });
  return finals >= MD3_MATCH_NOS.length;
}

export interface PrizeResolution {
  challenge: ChallengeFormat;
  outcome: "recorded" | "review" | "already-awarded" | "not-complete" | "no-entries";
}

// Resolve one challenge: if complete and not already awarded, record the rank-1
// eligible entry (or flag a tie for review) and notify the winner.
async function resolveOne(
  challenge: ChallengeFormat,
  tournamentId: string,
  rows: LeaderboardRow[],
  complete: boolean,
): Promise<PrizeResolution> {
  const existing = await prisma.prizeAward.findUnique({
    where: { challenge_tournamentId: { challenge, tournamentId } },
    select: { id: true },
  });
  if (existing) return { challenge, outcome: "already-awarded" };

  if (!complete) return { challenge, outcome: "not-complete" };

  const prize = PRIZES[challenge];
  const outcome = selectPrizeWinner(rows);
  if (outcome.kind === "none") return { challenge, outcome: "no-entries" };

  // The prize amount is resolved from the final eligible-entrant count (rows is
  // already filtered to complete + verified entries by the leaderboard queries),
  // so a scaled challenge locks its value at resolution time.
  const amount = computePrizeAmount(prize, rows.length);
  const prizePhrase = `a ${formatPrize(amount, prize.currency)} gift card`;

  // Create wrapped against the unique constraint so a concurrent run can't
  // double-award (the loser of the race hits P2002 and treats it as already done).
  try {
    if (outcome.kind === "tie") {
      await prisma.prizeAward.create({
        data: {
          challenge,
          tournamentId,
          status: "REVIEW",
          description: prizePhrase,
          amount,
          currency: prize.currency,
        },
      });
      return { challenge, outcome: "review" };
    }

    const winner = outcome.row;
    await prisma.prizeAward.create({
      data: {
        challenge,
        tournamentId,
        entryId: winner.entryId,
        userId: winner.userId ?? null,
        rank: 1,
        status: "PENDING",
        description: prizePhrase,
        amount,
        currency: prize.currency,
      },
    });
    await notifyWinner(challenge, winner, prizePhrase);
    return { challenge, outcome: "recorded" };
  } catch (err) {
    // Unique-constraint race: another run already recorded it.
    if ((err as { code?: string }).code === "P2002") {
      return { challenge, outcome: "already-awarded" };
    }
    throw err;
  }
}

// Best-effort winner notification (email + push). Never throws — a notify failure
// must not undo the recorded award.
async function notifyWinner(
  challenge: ChallengeFormat,
  winner: LeaderboardRow,
  prizePhrase: string,
): Promise<void> {
  const name = GAME_CATALOG[challenge].challengeName ?? "the challenge";

  if (winner.userId) {
    const user = await prisma.user.findUnique({
      where: { id: winner.userId },
      select: { email: true },
    });
    if (user?.email) {
      try {
        await sendPrizeEmail({
          to: user.email,
          challengeName: name,
          prizeDescription: prizePhrase,
        });
      } catch (err) {
        console.error(`prize email failed for ${challenge}:`, err);
      }
    }
    await sendPushToUser(winner.userId, {
      title: `You won the ${name}! 🏆`,
      body: `You topped the board and won ${prizePhrase}.`,
    });
  }
}

// Resolve prizes for every public challenge of a tournament. Idempotent: safe to
// call on a schedule (cron). Returns a per-challenge summary for logging.
export async function resolveChallengePrizes(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<PrizeResolution[]> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);

  const [koComplete, md3Complete, koRows, md3Rows] = await Promise.all([
    isKnockoutComplete(tournamentId),
    isMd3Complete(tournamentId),
    getChallengeLeaderboard(tournamentSlug),
    getMd3ChallengeLeaderboard(tournamentSlug),
  ]);

  return [
    await resolveOne("KNOCKOUT", tournamentId, koRows, koComplete),
    await resolveOne("MATCH_DAY_3_PICKEM", tournamentId, md3Rows, md3Complete),
  ];
}
