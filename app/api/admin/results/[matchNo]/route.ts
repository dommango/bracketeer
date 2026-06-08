// POST   /api/admin/results/[matchNo] — record a knockout winner (MANUAL beats API)
// DELETE /api/admin/results/[matchNo] — clear a previously-entered winner
// Tournament-admin only. Updates officialResults (the scoring source of truth),
// mirrors the Result row, then recomputes every pool under the tournament.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import {
  setKnockoutResult,
  clearKnockoutResult,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().optional(),
  winnerCode: z.string().min(1, "winnerCode is required"),
  homeScore: z.number().int().min(0).nullable().optional(),
  awayScore: z.number().int().min(0).nullable().optional(),
  final: z.boolean().optional(),
});

function parseMatchNo(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 73 && n <= 104 ? n : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchNo: string }> },
) {
  if (!(await getTournamentAdmin())) return apiError("Forbidden: tournament admin only", 403);

  const matchNo = parseMatchNo((await params).matchNo);
  if (matchNo === null) return apiError("matchNo must be a knockout match (73–104)", 400);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return apiError(`Invalid body: ${(err as Error).message}`, 400);
  }

  try {
    const tournamentId = await getTournamentIdBySlug(body.slug);
    const results = await setKnockoutResult(tournamentId, matchNo, {
      winnerCode: body.winnerCode,
      homeScore: body.homeScore ?? null,
      awayScore: body.awayScore ?? null,
      final: body.final,
    });
    const pools = await recomputeTournamentPools(tournamentId);
    return apiOk(
      { matchNo, winner: results.knockout[matchNo] },
      { meta: { poolsRecomputed: pools } },
    );
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ matchNo: string }> },
) {
  if (!(await getTournamentAdmin())) return apiError("Forbidden: tournament admin only", 403);

  const matchNo = parseMatchNo((await params).matchNo);
  if (matchNo === null) return apiError("matchNo must be a knockout match (73–104)", 400);

  try {
    const slug = req.nextUrl.searchParams.get("slug") ?? undefined;
    const tournamentId = await getTournamentIdBySlug(slug);
    await clearKnockoutResult(tournamentId, matchNo);
    const pools = await recomputeTournamentPools(tournamentId);
    return apiOk({ matchNo, winner: null }, { meta: { poolsRecomputed: pools } });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
