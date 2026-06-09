// GET /api/pool/[id]/picks — every entry's decoded picks + the current answer
// key + scoring config (members only). Feeds the client-side what-if island,
// which re-scores standings in-browser using the pure scoring engine.

import { getPoolAccess } from "@/lib/pool/access";
import { getEntriesWithPicks, getScoringContext } from "@/lib/pool/queries";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;

  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

  const context = await getScoringContext(poolId);
  if (!context) return apiError("Pool not found", 404);

  const entries = await getEntriesWithPicks(poolId);
  return apiOk({ entries, results: context.results, scoringConfig: context.scoringConfig });
}
