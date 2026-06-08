// POST /api/admin/standings — set group winners / runners-up / third advancers.
// Tournament-admin only. These live directly in officialResults (they aren't
// per-match outcomes). Recomputes every pool afterward.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getTournamentAdmin } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { setGroupStandings, recomputeTournamentPools } from "@/lib/pool/results";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().optional(),
  groupFirst: z.record(z.string(), z.string()).optional(),
  groupSecond: z.record(z.string(), z.string()).optional(),
  thirdAdvance: z.array(z.string()).max(8, "at most 8 third-place advancers").optional(),
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
    const results = await setGroupStandings(tournamentId, {
      groupFirst: body.groupFirst,
      groupSecond: body.groupSecond,
      thirdAdvance: body.thirdAdvance,
    });
    const pools = await recomputeTournamentPools(tournamentId);
    return apiOk(
      {
        groupFirst: results.groupFirst,
        groupSecond: results.groupSecond,
        thirdAdvance: results.thirdAdvance,
      },
      { meta: { poolsRecomputed: pools } },
    );
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
