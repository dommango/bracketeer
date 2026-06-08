// POST /api/admin/awards — set the four tournament awards (free text).
// Tournament-admin only. Recomputes every pool afterward.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { setAwards, recomputeTournamentPools } from "@/lib/pool/results";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().optional(),
  player: z.string().optional(),
  young: z.string().optional(),
  boot: z.string().optional(),
  goal: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getTournamentAdmin())) return apiError("Forbidden: tournament admin only", 403);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return apiError(`Invalid body: ${(err as Error).message}`, 400);
  }

  try {
    const tournamentId = await getTournamentIdBySlug(body.slug);
    const results = await setAwards(tournamentId, {
      player: body.player,
      young: body.young,
      boot: body.boot,
      goal: body.goal,
    });
    const pools = await recomputeTournamentPools(tournamentId);
    return apiOk(results.awards, { meta: { poolsRecomputed: pools } });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
